import { randomUUID } from "node:crypto";
import { pool } from "./db/pool.js";
import {
  CONDITIONS,
  COUNT_UNITS,
  RECEIPT_STATUSES,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABEL,
  SUPPLIER_STATUSES,
  SUPPLY_STATUSES,
  SUPPLY_STATUS_LABEL,
} from "./db/constants.js";
import {
  genNotifId,
  httpError,
  mapArrival,
  mapNotification,
  mapProduct,
  mapReceipt,
  mapRequestFulfillment,
  mapSupplier,
  mapSupplyRequest,
  toDbDateTime,
} from "./util.js";
import { logAudit } from "./audit.js";

/* Every read is scoped to a vendor/company account. `user` is the
   authenticated principal rebuilt from the DB (see auth.js requireVendor). */
const vendorIdOf = (user) => user?.vendorId ?? "";

/* Reject cross-vendor access to a single record. */
const assertVendorScope = (rowVendorId, user) => {
  if (rowVendorId !== undefined && rowVendorId !== null && String(rowVendorId) !== "" && String(rowVendorId) !== vendorIdOf(user)) {
    throw httpError(403, "You are not authorized to access this record.");
  }
};

const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round3 = (n) => Math.round(n * 1000) / 1000;

const formatQty = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(3)));

function parseItemQty(qty, unit) {
  if (qty === null) return { qty: null, message: "Item quantity must be a positive number." };
  if (qty <= 0) return { qty: null, message: "Item quantity must be greater than zero." };
  if (qty > 99999999) return { qty: null, message: "Item quantity is too large." };
  if (COUNT_UNITS.includes(unit)) {
    if (!Number.isInteger(qty)) {
      return { qty: null, message: `Quantity must be a whole number for "${unit}" units.` };
    }
  } else if (Math.abs(qty * 1000 - Math.round(qty * 1000)) > 1e-6) {
    return { qty: null, message: "Quantity supports at most 3 decimal places." };
  }
  return { qty };
}

function validateConditionBreakdown(items) {
  const byProduct = new Map();
  for (const it of items) {
    const key = `${it.productName}::${it.unit}`;
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(it);
  }
  for (const group of byProduct.values()) {
    const total = group.reduce((a, i) => a + i.qty, 0);
    const declared = group.filter((i) => i.declaredTotal !== null);
    if (declared.length === 0) {
      if (group.length > 1) {
        return `"${group[0].productName}": add the total received quantity for this item and split the received qty across conditions (GOOD + DAMAGED must equal the total).`;
      }
      continue;
    }
    if (declared.length !== group.length) {
      return `"${group[0].productName}": the total received quantity must be provided for every condition line of the same product/unit.`;
    }
    const first = declared[0].declaredTotal;
    const consistent = declared.every((i) => Math.abs(i.declaredTotal - first) < 1e-6);
    if (!consistent) {
      return `"${group[0].productName}": has conflicting declared totals for the same product.`;
    }
    if (Math.abs(total - first) > 1e-6) {
      return `"${group[0].productName}": condition quantities (${formatQty(total)}) must equal the total received quantity (${formatQty(first)}).`;
    }
  }
  return null;
}
function itemGroupTotals(items) {
  const groups = new Map();
  for (const it of items) {
    const key = `${it.productName}::${it.unit}`;
    const g = groups.get(key) ?? { productName: it.productName, unit: it.unit, declared: null, received: 0 };
    g.received = round3(g.received + it.qty);
    if (it.declaredTotal !== null) g.declared = it.declaredTotal;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, totalReceived: g.declared ?? g.received }));
}

async function assertWithinArrivalExpected(conn, arrivalId, items) {
  const [arrItems] = await conn.query(
    "SELECT product_name, unit, qty FROM arrival_items WHERE arrival_id = ?",
    [arrivalId]
  );
  const [priorRows] = await conn.query(
    `SELECT ri.product_name, ri.unit, COALESCE(SUM(ri.total_received_quantity), 0) AS s
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     WHERE r.arrival_id = ?
     GROUP BY ri.product_name, ri.unit`,
    [arrivalId]
  );
  const alreadyReceived = new Map(priorRows.map((r) => [`${r.product_name}::${r.unit}`, Number(r.s)]));
  for (const g of itemGroupTotals(items)) {
    const match = arrItems.find((a) => a.product_name === g.productName && a.unit === g.unit);
    if (!match) continue;
    const expected = Number(match.qty);
    const totalReceived = round3((alreadyReceived.get(`${g.productName}::${g.unit}`) ?? 0) + g.received);
    if (totalReceived > round3(expected)) {
      throw httpError(
        400,
        `Received quantity for "${g.productName}" (${totalReceived} ${g.unit}) exceeds the expected quantity (${expected} ${g.unit}).`
      );
    }
  }
}

async function loadSuppliers(vendorId) {
  const [rows] = await pool.query("SELECT * FROM suppliers WHERE vendor_id = ? ORDER BY company_name", [vendorId]);
  const [products] = await pool.query(
    "SELECT sp.* FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id WHERE s.vendor_id = ? ORDER BY sp.id",
    [vendorId]
  );
  const bySupplier = new Map();
  for (const p of products) {
    if (!bySupplier.has(p.supplier_id)) bySupplier.set(p.supplier_id, []);
    bySupplier.get(p.supplier_id).push(p);
  }
  return rows.map((r) => mapSupplier(r, bySupplier.get(r.id) ?? []));
}

async function loadArrivals(vendorId) {
  const [rows] = await pool.query("SELECT * FROM arrivals WHERE vendor_id = ? ORDER BY expected_date, expected_time", [vendorId]);
  const [items] = await pool.query("SELECT * FROM arrival_items ORDER BY id");
  const byArrival = new Map();
  for (const i of items) {
    if (!byArrival.has(i.arrival_id)) byArrival.set(i.arrival_id, []);
    byArrival.get(i.arrival_id).push(i);
  }
  return rows.map((r) => mapArrival(r, byArrival.get(r.id) ?? []));
}

async function loadReceipts(vendorId) {
  const [rows] = await pool.query("SELECT * FROM receipts WHERE vendor_id = ? ORDER BY received_at DESC", [vendorId]);
  const [items] = await pool.query("SELECT * FROM receipt_items ORDER BY id");
  const byReceipt = new Map();
  for (const i of items) {
    if (!byReceipt.has(i.receipt_id)) byReceipt.set(i.receipt_id, []);
    byReceipt.get(i.receipt_id).push(i);
  }
  return rows.map((r) => mapReceipt(r, byReceipt.get(r.id) ?? []));
}

async function loadNotifications(vendorId) {
  const [rows] = await pool.query("SELECT * FROM notifications WHERE vendor_id = ? ORDER BY created_at DESC", [vendorId]);
  return rows.map(mapNotification);
}

async function loadProducts(vendorId) {
  const [rows] = await pool.query(
    `SELECT sp.* FROM supplier_products sp
     JOIN suppliers s ON s.id = sp.supplier_id
     JOIN (
       SELECT MIN(id) AS id FROM supplier_products GROUP BY name
     ) keep ON keep.id = sp.id
     WHERE s.vendor_id = ?
     ORDER BY sp.name`,
    [vendorId]
  );
  return rows.map(mapProduct);
}

/* All receiving rows for receipts whose linked expected supply came from a
   supply request — used to derive request fulfillment from real receiving data. */
async function loadRequestFulfillmentRows(vendorId) {
  const [rows] = await pool.query(
    `SELECT r.id AS request_id, ri.product_name, ri.unit, ri.qty, ri.condition_value
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     JOIN arrivals a ON a.id = r.arrival_id
     WHERE a.supply_request_id IS NOT NULL AND a.vendor_id = ?`,
    [vendorId]
  );
  return rows;
}

async function loadSupplyRequests(vendorId) {
  const [rows] = await pool.query("SELECT * FROM supply_requests WHERE vendor_id = ? ORDER BY created_at DESC, id DESC", [vendorId]);
  const [items] = await pool.query("SELECT * FROM supply_request_items ORDER BY id");
  const byRequest = new Map();
  for (const i of items) {
    if (!byRequest.has(i.request_id)) byRequest.set(i.request_id, []);
    byRequest.get(i.request_id).push(i);
  }
  const fulfillmentRows = await loadRequestFulfillmentRows(vendorId);
  const byRequestRows = new Map();
  for (const r of fulfillmentRows) {
    if (!byRequestRows.has(r.request_id)) byRequestRows.set(r.request_id, []);
    byRequestRows.get(r.request_id).push(r);
  }
  return rows.map((r) => {
    const reqItems = byRequest.get(r.id) ?? [];
    return mapSupplyRequest(r, reqItems, mapRequestFulfillment(reqItems, byRequestRows.get(r.id) ?? []));
  });
}

export async function fetchSupplyRequests(vendorId) {
  return loadSupplyRequests(vendorId);
}

export async function fetchSupplyRequestById(id, vendorId) {
  const [rows] = await pool.query("SELECT * FROM supply_requests WHERE id = ?", [id]);
  if (rows.length === 0) return null;
  assertVendorScope(rows[0].vendor_id, { vendorId });
  const [items] = await pool.query("SELECT * FROM supply_request_items WHERE request_id = ? ORDER BY id", [id]);
  const [[linked]] = await pool.query(
    "SELECT a.id FROM arrivals a WHERE a.supply_request_id = ?",
    [id]
  );
  const fulfillmentRows = linked
    ? await pool.query(
        `SELECT ri.product_name, ri.unit, ri.qty, ri.condition_value
         FROM receipt_items ri
         JOIN receipts rc ON rc.id = ri.receipt_id
         JOIN arrivals a ON a.id = rc.arrival_id
         WHERE a.supply_request_id = ?`,
        [id]
      ).then((res) => res[0])
    : [];
  return mapSupplyRequest(rows[0], items, mapRequestFulfillment(items, fulfillmentRows));
}

export async function fetchBootstrap(user) {
  const vendorId = vendorIdOf(user);
  const [suppliers, arrivals, receipts, notifications, supplyRequests, products] = await Promise.all([
    loadSuppliers(vendorId),
    loadArrivals(vendorId),
    loadReceipts(vendorId),
    loadNotifications(vendorId),
    loadSupplyRequests(vendorId),
    loadProducts(vendorId),
  ]);
  return { suppliers, arrivals, receipts, notifications, supplyRequests, products };
}

export async function fetchReceiptById(id, vendorId) {
  const [rows] = await pool.query("SELECT * FROM receipts WHERE id = ?", [id]);
  if (rows.length === 0) return null;
  assertVendorScope(rows[0].vendor_id, { vendorId });
  const [items] = await pool.query("SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id", [id]);
  return mapReceipt(rows[0], items);
}

export async function fetchSupplierById(id, vendorId) {
  const [rows] = await pool.query("SELECT * FROM suppliers WHERE id = ? AND vendor_id = ?", [id, vendorId]);
  if (rows.length === 0) return null;
  const [products] = await pool.query("SELECT * FROM supplier_products WHERE supplier_id = ? ORDER BY id", [id]);
  const [[stats]] = await pool.query(
    `SELECT COUNT(*) AS receipt_count, COALESCE(SUM(total_qty), 0) AS total_received
     FROM receipts WHERE supplier_id = ? AND vendor_id = ?`,
    [id, vendorId]
  );
  return {
    ...mapSupplier(rows[0], products),
    stats: {
      receiptCount: Number(stats.receipt_count),
      totalReceived: Number(stats.total_received),
    },
  };
}

async function syncArrivalStatus(conn, arrivalId) {
  const [[sum]] = await conn.query(
    "SELECT COALESCE(SUM(total_qty), 0) AS s FROM receipts WHERE arrival_id = ?",
    [arrivalId]
  );
  const [[arr]] = await conn.query(
    "SELECT total_qty FROM arrivals WHERE id = ?",
    [arrivalId]
  );
  if (!arr) return;
  const [[bad]] = await conn.query(
    "SELECT COUNT(*) AS c FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id WHERE r.arrival_id = ? AND ri.condition_value <> 'good'",
    [arrivalId]
  );
  let status;
  if (Number(bad.c) > 0) status = "rejected_damaged";
  else if (Number(sum.s) >= Number(arr.total_qty)) status = "received";
  else status = "partially_received";
  await conn.query("UPDATE arrivals SET status = ? WHERE id = ?", [status, arrivalId]);
}

async function createNotification(conn, notif) {
  await conn.query(
    "INSERT INTO notifications (id, title, message, type, is_read, vendor_id, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    [genNotifId(), notif.title, notif.message, notif.type, notif.vendorId ?? "", toDbDateTime(new Date())]
  );
}

export function validateReceiptPayload(body, { requireId = false } = {}) {
  const errors = {};

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (requireId && !id) errors.id = "Receiving reference id is required.";
  else if (id && !/^[A-Za-z0-9:_-]{1,40}$/.test(id)) errors.id = "Invalid receiving reference format.";

  const supplierId = typeof body.supplierId === "string" ? body.supplierId.trim() : "";
  if (!supplierId) errors.supplier_id = "Supplier is required.";

  const arrivalId = typeof body.arrivalId === "string" && body.arrivalId.trim() ? body.arrivalId.trim() : null;

  const items = [];
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.items = "At least one receiving item is required.";
  } else {
    for (const raw of body.items) {
      const i = raw ?? {};
      const productName = typeof i.productName === "string" ? i.productName.trim() : "";
      const unit = typeof i.unit === "string" ? i.unit.trim() : "";
      const condition = typeof i.condition === "string" ? i.condition : "";
      const declaredTotal = toNumber(i.totalQty);
      const parsed = parseItemQty(toNumber(i.qty), unit);

      if (!productName) { errors.items = "Each item needs a product name."; break; }
      if (productName.length > 180) { errors.items = "Product name is too long."; break; }
      if (!unit || unit.length > 20) { errors.items = "Each item needs a valid unit."; break; }
      if (!CONDITIONS.includes(condition)) { errors.items = "Invalid receiving condition."; break; }
      if (parsed.qty === null) { errors.items = parsed.message; break; }
      if (declaredTotal !== null && declaredTotal <= 0) {
        errors.items = "Declared total quantity for an item must be positive.";
        break;
      }
      items.push({ productName, qty: parsed.qty, unit, condition, declaredTotal });
    }
  }

  const receivedAt = toDbDateTime(body.receivedAt ?? body.received_on ?? "");
  if (!receivedAt) errors.received_at = "Received date/time is required and must be valid.";

  const receivingBy = typeof body.receivingBy === "string" ? body.receivingBy.trim() : "";
  if (!receivingBy) errors.received_by = "Received by is required before confirming the receiving record.";

  const docRef = typeof body.docRef === "string" ? body.docRef.trim().slice(0, 120) : "";
  if (!docRef) errors.supplier_reference = "Supplier reference is required before confirming the receiving record.";

  const remarks = typeof body.remarks === "string" ? body.remarks.trim().slice(0, 500) : "";
  if (!remarks) errors.remarks = "Remarks are required before confirming the receiving record.";

  if (items.length > 0) {
    const mismatch = validateConditionBreakdown(items);
    if (mismatch) errors.items = mismatch;
  }

  if (Object.keys(errors).length > 0) {
    const keys = ["id", "supplier_id", "supplier_reference", "received_at", "received_by", "remarks", "items"];
    const message = keys.map((k) => errors[k]).find(Boolean) ?? errors[Object.keys(errors)[0]];
    throw httpError(400, message, { errors });
  }

  const totalQty = round3(items.reduce((a, i) => a + i.qty, 0));

  return { id, arrivalId, supplierId, items, receivedAt, receivingBy, docRef, remarks, totalQty };
}

export async function createReceipt(body, user) {
  const data = validateReceiptPayload(body, { requireId: true });
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dup] = await conn.query("SELECT id FROM receipts WHERE id = ?", [data.id]);
    if (dup.length > 0) throw httpError(409, "Receiving reference already exists.");

    const [sup] = await conn.query("SELECT id, company_name FROM suppliers WHERE id = ? AND vendor_id = ?", [data.supplierId, vendorId]);
    if (sup.length === 0) throw httpError(403, "Unknown or unauthorized supplier reference.");

    if (data.arrivalId) {
      const [arr] = await conn.query("SELECT id, supplier_id FROM arrivals WHERE id = ? AND vendor_id = ?", [data.arrivalId, vendorId]);
      if (arr.length === 0) throw httpError(403, "Unknown or unauthorized expected supply reference.");
      if (arr[0].supplier_id !== data.supplierId) {
        throw httpError(400, "Expected supply does not match the selected supplier.");
      }
      await assertWithinArrivalExpected(conn, data.arrivalId, data.items);
    }

    await conn.query(
      `INSERT INTO receipts
        (id, arrival_id, supplier_id, supplier_name, status, total_qty, received_at, receiving_by, doc_ref, remarks, vendor_id)
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)`,
      [data.id, data.arrivalId, data.supplierId, sup[0].company_name, data.totalQty,
        data.receivedAt, data.receivingBy, data.docRef, data.remarks, vendorId]
    );

    const groupTotals = itemGroupTotals(data.items);
    for (const it of data.items) {
      const totalReceived = groupTotals.find(
        (g) => g.productName === it.productName && g.unit === it.unit
      )?.totalReceived;
      await conn.query(
        "INSERT INTO receipt_items (receipt_id, product_name, qty, total_received_quantity, unit, condition_value) VALUES (?, ?, ?, ?, ?, ?)",
        [data.id, it.productName, it.qty, totalReceived, it.unit, it.condition]
      );
    }

    if (data.arrivalId) await syncArrivalStatus(conn, data.arrivalId);

    await createNotification(conn, {
      title: "Receiving Recorded",
      message: `${sup[0].company_name} - ${data.totalQty} units received${data.arrivalId ? ` against ${data.arrivalId}` : ""} (${data.id}).`,
      type: data.items.some((i) => i.condition !== "good") ? "error" : "success",
      vendorId,
    });

    await logAudit({
      conn,
      user,
      action: "receiving.create",
      entityType: "receipt",
      entityId: data.id,
      detail: `Recorded ${data.totalQty} units from ${sup[0].company_name} (${data.items.length} item line(s)).`,
      ip: user?.ip ?? "",
    });

    await conn.commit();
    return fetchReceiptById(data.id, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateReceipt(id, body, user) {
  const data = validateReceiptPayload(body);
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query("SELECT id, status, vendor_id FROM receipts WHERE id = ?", [id]);
    if (existing.length === 0) throw httpError(404, "Receiving transaction not found.");
    assertVendorScope(existing[0].vendor_id, user);
    if (existing[0].status === "completed") {
      throw httpError(409, "A completed receiving transaction cannot be edited.");
    }

    const [sup] = await conn.query("SELECT id, company_name FROM suppliers WHERE id = ? AND vendor_id = ?", [data.supplierId, vendorId]);
    if (sup.length === 0) throw httpError(403, "Unknown or unauthorized supplier reference.");

    if (data.arrivalId) {
      const [arr] = await conn.query("SELECT id, supplier_id FROM arrivals WHERE id = ? AND vendor_id = ?", [data.arrivalId, vendorId]);
      if (arr.length === 0) throw httpError(403, "Unknown or unauthorized expected supply reference.");
      if (arr[0].supplier_id !== data.supplierId) {
        throw httpError(400, "Expected supply does not match the selected supplier.");
      }
    }

    await conn.query(
      `UPDATE receipts
       SET arrival_id = ?, supplier_id = ?, supplier_name = ?, status = 'confirmed', total_qty = ?, received_at = ?,
           receiving_by = ?, doc_ref = ?, remarks = ?
       WHERE id = ?`,
      [data.arrivalId, data.supplierId, sup[0].company_name, data.totalQty,
        data.receivedAt, data.receivingBy, data.docRef, data.remarks, id]
    );

    await conn.query("DELETE FROM receipt_items WHERE receipt_id = ?", [id]);
    if (data.arrivalId) await assertWithinArrivalExpected(conn, data.arrivalId, data.items);
    const groupTotals = itemGroupTotals(data.items);
    for (const it of data.items) {
      const totalReceived = groupTotals.find(
        (g) => g.productName === it.productName && g.unit === it.unit
      )?.totalReceived;
      await conn.query(
        "INSERT INTO receipt_items (receipt_id, product_name, qty, total_received_quantity, unit, condition_value) VALUES (?, ?, ?, ?, ?, ?)",
        [id, it.productName, it.qty, totalReceived, it.unit, it.condition]
      );
    }

    if (data.arrivalId) await syncArrivalStatus(conn, data.arrivalId);

    await createNotification(conn, {
      title: "Receiving Record Updated",
      message: `${sup[0].company_name} - ${data.totalQty} units updated (${id}).`,
      type: data.items.some((i) => i.condition !== "good") ? "error" : "info",
      vendorId,
    });

    await logAudit({
      conn,
      user,
      action: "receiving.update",
      entityType: "receipt",
      entityId: id,
      detail: `Updated receiving to ${data.totalQty} units from ${sup[0].company_name}.`,
      ip: user?.ip ?? "",
    });

    await conn.commit();
    return fetchReceiptById(id, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function confirmReceipt(id, user) {
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT id, arrival_id, supplier_id, supplier_name, received_at, receiving_by, doc_ref, remarks, status, vendor_id FROM receipts WHERE id = ?",
      [id]
    );
    if (rows.length === 0) throw httpError(404, "Receiving transaction not found.");
    const row = rows[0];
    assertVendorScope(row.vendor_id, user);

    if (row.status === "confirmed" || row.status === "completed") {
      throw httpError(409, "This receiving transaction is already confirmed.");
    }
    if (!RECEIPT_STATUSES.includes(row.status)) {
      throw httpError(400, `Unknown receiving status "${row.status}".`);
    }

    const [items] = await conn.query(
      "SELECT product_name, qty, total_received_quantity, unit, condition_value FROM receipt_items WHERE receipt_id = ? ORDER BY id",
      [id]
    );

    validateReceiptPayload({
      id,
      supplierId: row.supplier_id,
      arrivalId: row.arrival_id ?? "",
      receivedAt: row.received_at,
      receivingBy: row.receiving_by,
      docRef: row.doc_ref,
      remarks: row.remarks,
      items: items.map((i) => ({
        productName: i.product_name,
        qty: Number(i.qty),
        unit: i.unit,
        condition: i.condition_value,
        totalQty: i.total_received_quantity == null ? undefined : Number(i.total_received_quantity),
      })),
    });

    await conn.query("UPDATE receipts SET status = 'confirmed' WHERE id = ?", [id]);

    await createNotification(conn, {
      title: "Receiving Confirmed",
      message: `${row.supplier_name} - ${id} confirmed.`,
      type: items.some((i) => i.condition_value !== "good") ? "error" : "success",
      vendorId,
    });

    await logAudit({
      conn,
      user,
      action: "receiving.confirm",
      entityType: "receipt",
      entityId: id,
      detail: `Confirmed receiving ${id} (${row.supplier_name}).`,
      ip: user?.ip ?? "",
    });

    await conn.commit();
    return fetchReceiptById(id, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateArrivalStatus(id, status, user) {
  if (!SUPPLY_STATUSES.includes(status)) throw httpError(400, "Invalid supply status.");
  const [rows] = await pool.query("SELECT id, supplier_name, status, vendor_id FROM arrivals WHERE id = ?", [id]);
  if (rows.length === 0) throw httpError(404, "Expected supply not found.");
  assertVendorScope(rows[0].vendor_id, user);
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE arrivals SET status = ? WHERE id = ?", [status, id]);
    await createNotification(conn, {
      title: "Supply status updated",
      message: `${rows[0].supplier_name} (${id}) moved to ${SUPPLY_STATUS_LABEL[status]}.`,
      type: status === "rejected_damaged" ? "error" : status === "completed" ? "success" : "info",
      vendorId,
    });
    await logAudit({
      conn,
      user,
      action: "arrival.status",
      entityType: "arrival",
      entityId: id,
      detail: `Moved expected supply ${id} to ${status}.`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function setSupplierStatus(id, status, user) {
  if (!SUPPLIER_STATUSES.includes(status)) throw httpError(400, "Invalid supplier status.");
  const [rows] = await pool.query("SELECT id, vendor_id FROM suppliers WHERE id = ?", [id]);
  if (rows.length === 0) throw httpError(404, "Supplier not found.");
  assertVendorScope(rows[0].vendor_id, user);
  await pool.query("UPDATE suppliers SET status = ? WHERE id = ?", [status, id]);
  await logAudit({
    user,
    action: "supplier.status",
    entityType: "supplier",
    entityId: id,
    detail: `Supplier ${id} set to ${status}.`,
    ip: user?.ip ?? "",
  });
  return { ok: true };
}

export async function markNotificationRead(id, user) {
  const [res] = await pool.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND vendor_id = ?", [id, vendorIdOf(user)]);
  if (res.affectedRows === 0) throw httpError(404, "Notification not found.");
  return { ok: true };
}

export async function markAllNotificationsRead(user) {
  await pool.query("UPDATE notifications SET is_read = 1 WHERE vendor_id = ?", [vendorIdOf(user)]);
  return { ok: true };
}

export async function clearNotifications(user) {
  await pool.query("DELETE FROM notifications WHERE vendor_id = ?", [vendorIdOf(user)]);
  return { ok: true };
}

/* ── supply requests ────────────────────────────────────── */

function validateRequestDate(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, message: "Needed-by date is required and must be a valid date (YYYY-MM-DD)." };
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(+d)) return { ok: false, message: "Needed-by date must be a valid date." };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return { ok: false, message: "Needed-by date cannot be in the past." };
  return { ok: true, value: s };
}

export function validateSupplyRequestPayload(body, { requireId = false } = {}) {
  const errors = {};

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (requireId && !id) errors.id = "Request reference is required.";
  else if (id && !/^[A-Za-z0-9:_-]{1,40}$/.test(id)) errors.id = "Invalid request reference format.";

  /* Minimum privilege: vendors must never touch Supply Chain-owned fields.
     Assigning a supplier, setting an SC reference, or picking a status are
     Supply Chain responsibilities and are rejected outright. */
  const scFields = (k) => typeof body[k] === "string" ? body[k].trim() : (body[k] == null ? "" : String(body[k]));
  if (scFields("supplierId") || scFields("supplierName") || scFields("scReference") || scFields("processingStatus") || scFields("expectedDeliveryDate")) {
    errors.sc_fields = "Vendors cannot assign suppliers or set Supply Chain fields on a request.";
  }

  if (["approve", "approved", "reject", "rejected", "fulfill"].includes(scFields("status"))) {
    errors.sc_fields = "Vendors cannot approve, reject, or fulfill their own requests.";
  }

  const neededBy = validateRequestDate(body.neededByDate);
  if (!neededBy.ok) errors.needed_by_date = neededBy.message;

  const priority = typeof body.priority === "string" && body.priority ? body.priority : "normal";
  if (!REQUEST_PRIORITIES.includes(priority)) errors.priority = "Invalid priority. Use low, normal, high, or urgent.";

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) errors.reason = "Reason / purpose is required.";
  else if (reason.length > 500) errors.reason = "Reason is too long (max 500 characters).";

  const remarks = typeof body.remarks === "string" ? body.remarks.trim().slice(0, 500) : "";

  const items = [];
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.items = "At least one requested supply item is required.";
  } else if (body.items.length > 30) {
    errors.items = "A request can have at most 30 items.";
  } else {
    const seen = new Set();
    for (let idx = 0; idx < body.items.length; idx++) {
      const raw = body.items[idx] ?? {};
      const productId = toNumber(raw.productId);
      const unit = typeof raw.unit === "string" ? raw.unit.trim() : "";
      const parsed = parseItemQty(toNumber(raw.qty), unit);
      if (productId === null || !Number.isInteger(productId) || productId <= 0) {
        errors.items = `Item ${idx + 1}: select a valid product from the product database.`;
        break;
      }
      if (!unit || unit.length > 20) { errors.items = `Item ${idx + 1}: select a valid unit.`; break; }
      if (parsed.qty === null) { errors.items = `Item ${idx + 1}: ${parsed.message}`; break; }
      const key = `${productId}::${unit}`;
      if (seen.has(key)) { errors.items = `Item ${idx + 1}: duplicate product in the same request is not allowed.`; break; }
      seen.add(key);
      items.push({
        productId,
        unit,
        qty: parsed.qty,
        remarks: typeof raw.remarks === "string" ? raw.remarks.trim().slice(0, 500) : "",
      });
    }
  }

  if (Object.keys(errors).length > 0) {
    const keys = ["id", "needed_by_date", "priority", "reason", "items"];
    const message = keys.map((k) => errors[k]).find(Boolean) ?? errors[Object.keys(errors)[0]];
    throw httpError(400, message, { errors });
  }

  return { id, neededBy: neededBy.value, priority, reason, remarks, items };
}

async function resolveItemProducts(conn, items, vendorId) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const [rows] = await conn.query(
    `SELECT sp.id, sp.name FROM supplier_products sp
     JOIN suppliers s ON s.id = sp.supplier_id
     WHERE sp.id IN (${ids.map(() => "?").join(",")}) AND s.vendor_id = ?`,
    [...ids, vendorId]
  );
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  for (const it of items) {
    if (!nameById.has(it.productId)) {
      throw httpError(400, "One or more selected products do not exist in the product database.");
    }
  }
  return items.map((it) => ({ ...it, productName: nameById.get(it.productId) }));
}

async function nextRequestReference(conn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const year = new Date().getFullYear();
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) AS c FROM supply_requests WHERE id LIKE ?",
      [`VR-${year}-%`]
    );
    const ref = `VR-${year}-${String(c + 1).padStart(4, "0")}`;
    const [collision] = await conn.query("SELECT id FROM supply_requests WHERE id = ?", [ref]);
    if (collision.length === 0) return ref;
  }
  throw httpError(409, "Could not generate a unique request reference. Please retry.");
}

async function assertRequestOwner(reqRow, user) {
  assertVendorScope(reqRow.vendor_id, user);
  if (Number(reqRow.requested_by) !== Number(user.sub)) {
    throw httpError(403, "You can only manage your own supply requests.");
  }
}

export async function createSupplyRequest(body, user) {
  if (!user || !user.sub) throw httpError(401, "Unauthorized.");
  const data = validateSupplyRequestPayload(body);
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ref = await nextRequestReference(conn);
    const resolved = await resolveItemProducts(conn, data.items, vendorId);
    await conn.query(
      `INSERT INTO supply_requests (id, requested_by, request_date, needed_by_date, priority, reason, remarks, status, vendor_id)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, 'draft', ?)`,
      [ref, user.sub, data.neededBy, data.priority, data.reason, data.remarks, vendorId]
    );
    for (const it of resolved) {
      await conn.query(
        `INSERT INTO supply_request_items (request_id, product_id, product_name, quantity, unit, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ref, it.productId, it.productName, it.qty, it.unit, it.remarks]
      );
    }
    await logAudit({
      conn,
      user,
      action: "request.create",
      entityType: "supply_request",
      entityId: ref,
      detail: `Created ${ref} with ${data.items.length} item line(s).`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return fetchSupplyRequestById(ref, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateSupplyRequest(id, body, user) {
  if (!user || !user.sub) throw httpError(401, "Unauthorized.");
  const data = validateSupplyRequestPayload(body);
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT id, requested_by, status, vendor_id FROM supply_requests WHERE id = ?", [id]);
    if (rows.length === 0) throw httpError(404, "Supply request not found.");
    await assertRequestOwner(rows[0], user);
    if (rows[0].status !== "draft") {
      throw httpError(409, "Only draft requests can be edited. Submit a new revision instead.");
    }
    const resolved = await resolveItemProducts(conn, data.items, vendorId);
    await conn.query(
      `UPDATE supply_requests SET needed_by_date = ?, priority = ?, reason = ?, remarks = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.neededBy, data.priority, data.reason, data.remarks, id]
    );
    await conn.query("DELETE FROM supply_request_items WHERE request_id = ?", [id]);
    for (const it of resolved) {
      await conn.query(
        `INSERT INTO supply_request_items (request_id, product_id, product_name, quantity, unit, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, it.productId, it.productName, it.qty, it.unit, it.remarks]
      );
    }
    await logAudit({
      conn,
      user,
      action: "request.update",
      entityType: "supply_request",
      entityId: id,
      detail: `Updated ${id} (${data.items.length} item line(s)).`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return fetchSupplyRequestById(id, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function submitSupplyRequest(id, user) {
  if (!user || !user.sub) throw httpError(401, "Unauthorized.");
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT id, requested_by, status, vendor_id FROM supply_requests WHERE id = ?", [id]);
    if (rows.length === 0) throw httpError(404, "Supply request not found.");
    await assertRequestOwner(rows[0], user);
    if (rows[0].status !== "draft") {
      throw httpError(409, rows[0].status === "submitted"
        ? "This supply request has already been submitted."
        : "Only draft requests can be submitted.");
    }
    const [[itemCount]] = await conn.query(
      "SELECT COUNT(*) AS c FROM supply_request_items WHERE request_id = ?",
      [id]
    );
    if (Number(itemCount.c) === 0) throw httpError(400, "A supply request needs at least one item before it can be submitted.");
    await conn.query("UPDATE supply_requests SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = ?", [id]);
    await createNotification(conn, {
      title: "Supply Request Submitted",
      message: `${id} has been submitted to the Supply Chain subsystem for review and sourcing.`,
      type: "info",
      vendorId,
    });
    await logAudit({
      conn,
      user,
      action: "request.submit",
      entityType: "supply_request",
      entityId: id,
      detail: `Submitted ${id} to Supply Chain.`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return fetchSupplyRequestById(id, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function cancelSupplyRequest(id, user) {
  if (!user || !user.sub) throw httpError(401, "Unauthorized.");
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT id, requested_by, status, vendor_id FROM supply_requests WHERE id = ?", [id]);
    if (rows.length === 0) throw httpError(404, "Supply request not found.");
    await assertRequestOwner(rows[0], user);
    if (rows[0].status !== "draft" && rows[0].status !== "submitted") {
      throw httpError(409, "This request is already being processed and can no longer be cancelled by the vendor.");
    }
    await conn.query("UPDATE supply_requests SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [id]);
    await createNotification(conn, {
      title: "Supply Request Cancelled",
      message: `${id} was cancelled before processing resumed.`,
      type: "warning",
      vendorId,
    });
    await logAudit({
      conn,
      user,
      action: "request.cancel",
      entityType: "supply_request",
      entityId: id,
      detail: `Cancelled ${id}.`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return fetchSupplyRequestById(id, vendorId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* Reserved for the Supply Chain subsystem — the Vendor API never exposes it. */
export async function advanceSupplyChainStatus(id, status) {
  if (!REQUEST_STATUSES.includes(status)) throw httpError(400, "Invalid request status.");
  const [rows] = await pool.query("SELECT id, status FROM supply_requests WHERE id = ?", [id]);
  if (rows.length === 0) throw httpError(404, "Supply request not found.");
  const from = rows[0].status;
  const allowed = {
    submitted: ["under_review", "rejected"],
    under_review: ["approved", "rejected"],
    approved: ["processing", "rejected"],
    processing: ["fulfillment_in_progress"],
    fulfillment_in_progress: ["partially_fulfilled", "fulfilled"],
    partially_fulfilled: ["fulfilled"],
  };
  if (!(allowed[from] ?? []).includes(status)) {
    throw httpError(409, `Allowed transition from "${REQUEST_STATUS_LABEL[from]}" is ${allowed[from] ?? []}.`);
  }
  await pool.query("UPDATE supply_requests SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
  return { ok: true };
}

export async function fetchDashboard(user) {
  const vendorId = vendorIdOf(user);
  const [suppliers, arrivals, receipts, notifications] = await Promise.all([
    loadSuppliers(vendorId),
    loadArrivals(vendorId),
    loadReceipts(vendorId),
    loadNotifications(vendorId),
  ]);

  const byStatus = arrivals.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const supplierSummary = suppliers.map((s) => {
    const expectedQty = arrivals
      .filter((a) => a.supplierId === s.id)
      .reduce((a, r) => a + r.totalQty, 0);
    const receivedQty = receipts
      .filter((r) => r.supplierId === s.id)
      .reduce((a, r) => a + r.totalQty, 0);
    const txCount = receipts.filter((r) => r.supplierId === s.id).length;
    return {
      id: s.id,
      companyName: s.companyName,
      status: s.status,
      expectedQty,
      receivedQty,
      receiptCount: txCount,
    };
  });

  const upcoming = arrivals
    .filter((a) => a.status === "expected" || a.status === "for_receiving")
    .slice()
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    .slice(0, 5);

  return {
    counts: byStatus,
    totalArrivals: arrivals.length,
    totalReceipts: receipts.length,
    recentReceipts: receipts.slice(0, 5),
recentNotifications: notifications.slice(0, 4),
    upcoming,
    supplierSummary,
  };
}

export async function fetchCompanyProfile(user) {
  const vendorId = vendorIdOf(user);
  const [rows] = await pool.query(
    "SELECT id, company_name, contact_name, contact_email, contact_phone, address, is_active FROM vendors WHERE id = ?",
    [vendorId]
  );
  if (rows.length === 0) throw httpError(404, "Company profile not found.");
  return {
    id: rows[0].id,
    companyName: rows[0].company_name,
    contactName: rows[0].contact_name,
    contactEmail: rows[0].contact_email,
    contactPhone: rows[0].contact_phone,
    address: rows[0].address,
    isActive: Number(rows[0].is_active) === 1,
  };
}

export async function updateCompanyProfile(user, patch) {
  const vendorId = vendorIdOf(user);
  const body = patch ?? {};
  const errors = {};

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (!companyName) errors.companyName = "Company name is required.";
  else if (companyName.length > 180) errors.companyName = "Company name must be 180 characters or fewer.";

  const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
  if (contactName.length > 120) errors.contactName = "Contact name must be 120 characters or fewer.";

  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) errors.contactEmail = "Enter a valid email address.";
  else if (contactEmail.length > 160) errors.contactEmail = "Email must be 160 characters or fewer.";

  const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
  if (contactPhone.length > 60) errors.contactPhone = "Phone must be 60 characters or fewer.";

  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (address.length > 255) errors.address = "Address must be 255 characters or fewer.";

  if (Object.keys(errors).length > 0) throw httpError(400, Object.values(errors)[0], { errors });

  const [res] = await pool.query(
    "UPDATE vendors SET company_name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, address = ?, updated_at = NOW() WHERE id = ?",
    [companyName, contactName, contactEmail, contactPhone, address, vendorId]
  );
  if (res.affectedRows === 0) throw httpError(404, "Company profile not found.");

  await logAudit({
    user,
    action: "company.update",
    entityType: "vendor",
    entityId: vendorId,
    detail: "Updated company profile details.",
    ip: user?.ip ?? "",
  });
  return fetchCompanyProfile(user);
}

export async function listCompanyDocuments(user) {
  const [rows] = await pool.query(
    "SELECT id, original_name, mime_type, size_bytes, uploaded_by, created_at FROM company_documents WHERE vendor_id = ? ORDER BY created_at DESC",
    [vendorIdOf(user)]
  );
  return rows.map((r) => ({
    id: r.id,
    originalName: r.original_name,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    uploadedBy: Number(r.uploaded_by),
    uploadedAt: r.created_at,
  }));
}

export async function insertCompanyDocument({ user, vendorId, originalName, storedName, mimeType, sizeBytes }) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO company_documents (id, vendor_id, original_name, stored_name, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, vendorId, originalName, storedName, mimeType, sizeBytes, user.sub]
  );
  await logAudit({
    user,
    action: "company.document.upload",
    entityType: "company_document",
    entityId: id,
    detail: `Uploaded ${originalName} (${sizeBytes} bytes).`,
    ip: user?.ip ?? "",
  });
  return { ok: true, id };
}

export async function fetchCompanyDocument(id, user) {
  const [rows] = await pool.query(
    "SELECT id, vendor_id, original_name, stored_name, mime_type, size_bytes FROM company_documents WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  assertVendorScope(rows[0].vendor_id, user);
  return {
    id: rows[0].id,
    originalName: rows[0].original_name,
    storedName: rows[0].stored_name,
    mimeType: rows[0].mime_type,
    sizeBytes: Number(rows[0].size_bytes),
    vendorId: rows[0].vendor_id,
  };
}

export async function deleteCompanyDocument(id, user) {
  const [rows] = await pool.query("SELECT vendor_id, original_name FROM company_documents WHERE id = ?", [id]);
  if (rows.length === 0) throw httpError(404, "Document not found.");
  assertVendorScope(rows[0].vendor_id, user);
  await pool.query("DELETE FROM company_documents WHERE id = ? AND vendor_id = ?", [id, vendorIdOf(user)]);
  await logAudit({
    user,
    action: "company.document.delete",
    entityType: "company_document",
    entityId: id,
    detail: `Deleted document ${rows[0].original_name}.`,
    ip: user?.ip ?? "",
  });
  return { ok: true };
}
