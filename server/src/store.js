import { randomUUID } from "node:crypto";
import { pool } from "./db/pool.js";
import {
  CONDITIONS,
  COUNT_UNITS,
  DEFAULT_VENDOR_ID,
  EVALUATION_CRITERIA,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABEL,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  SUPPLY_STATUSES,
} from "./db/constants.js";
import {
  genId,
  genNotifId,
  httpError,
  mapApplication,
  mapArrival,
  mapAuditLog,
  mapEvaluation,
  mapNotification,
  mapProduct,
  mapReceipt,
  mapRequestFulfillment,
  mapSupplier,
  mapSupplyRequest,
  mapVendorReceiving,
  toDbDateTime,
  toIso,
} from "./util.js";
import { logAudit } from "./audit.js";

/* Every read is scoped to a vendor/company account. `user` is the
   authenticated principal rebuilt from the DB (see auth.js requireVendor). */
export const vendorIdOf = (user) => user?.vendorId ?? "";

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
  /* Delivery documents attached to Supply Chain deliveries (SC-DLV-…), joined
     against the vendor's own arrivals so a foreign document can never leak. */
  const [docRows] = await pool.query(
    `SELECT d.* FROM delivery_documents d
     JOIN arrivals a ON a.id = d.arrival_id
     WHERE a.vendor_id = ?
     ORDER BY d.id`,
    [vendorId]
  );
  const byArrivalDocs = new Map();
  for (const d of docRows) {
    if (!byArrivalDocs.has(d.arrival_id)) byArrivalDocs.set(d.arrival_id, []);
    byArrivalDocs.get(d.arrival_id).push(d);
  }
  const arrivals = rows.map((r) => mapArrival(r, byArrival.get(r.id) ?? [], byArrivalDocs.get(r.id) ?? []));
  await enrichArrivalFulfillment(arrivals, vendorId);
  return arrivals;
}

/* Attach per-product receiving math to each arrival item so the UI can show
   the Checker result and the Vendor acknowledgment without re-querying.
   acceptedQty         = GOOD units from ALL inspection receipts (original +
                         replacement) → the accepted stock available to Vendor.
   damagedQty          = damaged + rejected units from inspection (read-only; this
                         is the Checker's result, never editable by the Vendor).
   vendorReceived      = units the Vendor has ACKNOWLEDGED receiving so far.
   availableQty        = acceptedQty − vendorReceived (the Vendor can never
                         receive more than this).
   replacementRequired = Expected − Accepted(original inspection).
   Arrival totals (acceptedQty / receivedQty / remainingQty) are attached for
   the progress bars. Status itself is derived by syncArrivalStatus. */
async function enrichArrivalFulfillment(arrivals, vendorId) {
  if (arrivals.length === 0) return;
  const placeholders = arrivals.map(() => "?").join(",");
  const [rips] = await pool.query(
    `SELECT r.arrival_id, ri.product_name, ri.unit, ri.condition_value,
            COALESCE(SUM(ri.qty), 0) AS qty,
            MAX(CASE WHEN r.kind = 'replacement' THEN 'replacement' ELSE 'original' END) AS kind
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     WHERE r.vendor_id = ? AND r.arrival_id IN (${placeholders})
     GROUP BY r.arrival_id, ri.product_name, ri.unit, ri.condition_value, r.kind
     HAVING SUM(ri.qty) > 0`,
    [vendorId, ...arrivals.map((a) => a.id)]
  );
  const ripsByArrival = new Map();
  for (const row of rips) {
    if (!ripsByArrival.has(row.arrival_id)) ripsByArrival.set(row.arrival_id, []);
    ripsByArrival.get(row.arrival_id).push(row);
  }
  const ackParam = arrivals.map(() => "?").join(",");
  const [acks] = await pool.query(
    `SELECT arrival_id, product_name, unit, COALESCE(SUM(received_qty), 0) AS received
     FROM vendor_receiving_items
     WHERE arrival_id IN (${ackParam})
     GROUP BY arrival_id, product_name, unit`,
    [...arrivals.map((a) => a.id)]
  );
  const ackByArrival = new Map();
  for (const row of acks) {
    if (!ackByArrival.has(row.arrival_id)) ackByArrival.set(row.arrival_id, []);
    ackByArrival.get(row.arrival_id).push(row);
  }
  for (const a of arrivals) {
    const rows = ripsByArrival.get(a.id) ?? [];
    const ackRows = ackByArrival.get(a.id) ?? [];
    const ackMap = new Map(ackRows.map((r) => [`${r.product_name}::${r.unit}`, Number(r.received)]));
    let requiredTotal = 0;
    let acceptedTotal = 0;
    let receivedTotal = 0;
    for (const it of a.items) {
      const key = `${it.productName}::${it.unit}`;
      const bucket = { good: 0, originalGood: 0, replacementGood: 0, damaged: 0 };
      for (const row of rows) {
        if (row.product_name !== it.productName || row.unit !== it.unit) continue;
        const qty = Number(row.qty);
        const kind = row.kind === "replacement" ? "replacement" : "original";
        if (row.condition_value === "good") {
          bucket.good += qty;
          if (kind === "replacement") bucket.replacementGood += qty;
          else bucket.originalGood += qty;
        } else {
          bucket.damaged += qty;
        }
      }
      const good = round3(bucket.good);
      const originalGood = round3(bucket.originalGood);
      const damaged = round3(bucket.damaged);
      const vendorReceived = round3(ackMap.get(key) ?? 0);
      const availableQty = round3(Math.max(0, good - vendorReceived));
      const replacementRequired = round3(Math.max(0, Number(it.qty) - originalGood));
      const replacementReceived = round3(bucket.replacementGood);
      const replacementRemaining = round3(Math.max(0, replacementRequired - replacementReceived));
      const requiredQty = round3(Number(it.qty));
      const remainingQty = round3(Math.max(0, requiredQty - vendorReceived));
      requiredTotal += requiredQty;
      acceptedTotal += good;
      receivedTotal += vendorReceived;
      Object.assign(it, {
        requiredQty,
        acceptedQty: good,
        damagedQty: damaged,
        replacementRequired,
        replacementReceived,
        replacementRemaining,
        vendorReceived,
        availableQty,
        remainingQty,
        fulfilled: vendorReceived >= requiredQty - 1e-9,
      });
    }
    Object.assign(a, {
      requiredQty: round3(requiredTotal),
      acceptedQty: round3(acceptedTotal),
      receivedQty: round3(receivedTotal),
      remainingQty: round3(Math.max(0, requiredTotal - receivedTotal)),
    });
  }
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

/* Receiving history filtered by the actual stored received_at date.
   The range is inclusive of the full From and To calendar days: a To date
   is expanded by one day so records at any stored time that day are kept. */
export async function fetchReceiptHistory(user, { fromDate, toDate } = {}) {
  const vendorId = vendorIdOf(user);
  const where = ["vendor_id = ?"];
  const params = [vendorId];
  if (fromDate) {
    where.push("received_at >= ?");
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    where.push("received_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(`${toDate} 00:00:00`);
  }
  const [rows] = await pool.query(`SELECT * FROM receipts WHERE ${where.join(" AND ")} ORDER BY received_at DESC`, params);
  const ids = rows.map((r) => r.id);
  let items = [];
  if (ids.length > 0) {
    const [itemRows] = await pool.query(
      `SELECT * FROM receipt_items WHERE receipt_id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
      ids
    );
    items = itemRows;
  }
  const byReceipt = new Map();
  for (const i of items) {
    if (!byReceipt.has(i.receipt_id)) byReceipt.set(i.receipt_id, []);
    byReceipt.get(i.receipt_id).push(i);
  }
  return rows.map((r) => mapReceipt(r, byReceipt.get(r.id) ?? []));
}

/* Vendor Receiving History from vendor_receivings table.

   Only COMPLETE acknowledgments belong here. A delivery whose accepted stock
   is still being acknowledged in part (arrival status pending /
   partially_received) stays in the Receiving work queue and must not appear in
   the history yet — the history is the closed, fully-received ledger. The
   completion target is the arrival's ORIGINAL required quantity, exactly as
   syncArrivalStatus() computes it, so this filter and the arrival status can
   never disagree.

   Items carry no condition state: the Vendor acknowledges checker-ACCEPTED
   stock only, so damaged/rejected quantities are never part of this table. */
export async function fetchVendorReceivingHistory(user, { fromDate, toDate } = {}) {
  const vendorId = vendorIdOf(user);
  const where = ["vr.vendor_id = ?", "a.status = 'completed'"];
  const params = [vendorId];
  if (fromDate) {
    where.push("vr.received_at >= ?");
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    where.push("vr.received_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(`${toDate} 00:00:00`);
  }

  const [vrRows] = await pool.query(
    `SELECT vr.*, a.supplier_id AS a_supplier_id, a.supplier_name AS a_supplier_name, a.source_ref AS a_source_ref
     FROM vendor_receivings vr
     JOIN arrivals a ON a.id = vr.arrival_id
     WHERE ${where.join(" AND ")}
     ORDER BY vr.received_at DESC`,
    params
  );

  if (vrRows.length === 0) return [];

  const vrIds = vrRows.map((r) => r.id);
  const [vriRows] = await pool.query(
    `SELECT * FROM vendor_receiving_items WHERE receiving_id IN (${vrIds.map(() => "?").join(",")}) ORDER BY id`,
    vrIds
  );

  /* Group vendor_receiving_items by receiving_id */
  const byReceiving = new Map();
  for (const it of vriRows) {
    if (!byReceiving.has(it.receiving_id)) byReceiving.set(it.receiving_id, []);
    byReceiving.get(it.receiving_id).push(it);
  }

  /* Also get supplier info for the vendor_receivings */
  const [supplierRows] = await pool.query(
    `SELECT s.id, s.company_name FROM suppliers s WHERE s.id IN (${[...new Set(vrRows.map((r) => r.a_supplier_id))].map(() => "?").join(",")})`,
    [...new Set(vrRows.map((r) => r.a_supplier_id))]
  );
  const supplierMap = new Map(supplierRows.map((s) => [s.id, s.company_name]));

  return vrRows.map((vr) => {
    const items = byReceiving.get(vr.id) ?? [];
    const supplierName = supplierMap.get(vr.a_supplier_id) ?? vr.a_supplier_name ?? "";
    const mappedItems = items.map((it) => ({
      productName: it.product_name,
      qty: Number(it.received_qty),
      unit: it.unit,
      condition: "good",
      totalQty: Number(it.received_qty),
    }));

    const totalQty = mappedItems.reduce((a, i) => a + i.qty, 0);
    const conditionSummary = {
      good: totalQty,
      damaged: 0,
      rejected: 0,
    };

    return {
      id: vr.id,
      arrivalId: vr.arrival_id,
      supplierId: vr.a_supplier_id ?? "",
      supplierName,
      items: mappedItems,
      totalQty,
      conditionSummary,
      kind: "original",
      replacementRequestId: null,
      receivedAt: toIso(vr.received_at),
      receivingBy: vr.received_by,
      docRef: vr.id,
      remarks: vr.remarks ?? "",
    };
  });
}

export async function fetchSupplyRequestStatusCounts(vendorId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM supply_requests WHERE vendor_id = ? GROUP BY status`,
    [vendorId]
  );
  const counts = {};
  for (const r of rows) {
    counts[r.status] = Number(r.cnt);
  }
  return counts;
}

async function loadNotifications(vendorId, role = "all") {
  const [rows] = await pool.query(
    "SELECT * FROM notifications WHERE vendor_id = ? AND (recipient = 'all' OR recipient = ?) ORDER BY created_at DESC",
    [vendorId, role]
  );
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
    `SELECT a.supply_request_id AS request_id, ri.product_name, ri.unit, ri.qty, ri.condition_value
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
  const [suppliers, arrivals, receipts, notifications, supplyRequests, products, applications, vendorReceivings] = await Promise.all([
    loadSuppliers(vendorId),
    loadArrivals(vendorId),
    loadReceipts(vendorId),
    loadNotifications(vendorId, user.role ?? "all"),
    loadSupplyRequests(vendorId),
    loadProducts(vendorId),
    fetchApplications(user),
    listVendorReceivings(user),
  ]);
  return { suppliers, arrivals, receipts, notifications, supplyRequests, products, applications, vendorReceivings };
}

export async function fetchReceiptById(id, vendorId) {
  const [rows] = await pool.query("SELECT * FROM receipts WHERE id = ?", [id]);
  if (rows.length === 0) return null;
  assertVendorScope(rows[0].vendor_id, { vendorId });
  const [items] = await pool.query("SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id", [id]);
  return mapReceipt(rows[0], items);
}

/* ── Supply Chain delivery documents ───────────────────────
   Documents travel WITH the Supply Chain delivery (arrivals) record. The
   Vendor Receiving form reads them from the linked arrival — never re-typed
   or re-uploaded by the receiving staff unless a vendor-supplied document is
   mandatory. Every read/download is scoped to the vendor account. */

const assertArrivalScope = async (arrivalId, user) => {
  const [arr] = await pool.query("SELECT id, vendor_id FROM arrivals WHERE id = ?", [arrivalId]);
  if (arr.length === 0) throw httpError(404, "Supply Chain delivery not found.");
  assertVendorScope(arr[0].vendor_id, user);
  return arr[0];
};

export async function listDeliveryDocuments(arrivalId, user) {
  await assertArrivalScope(arrivalId, user);
  const [rows] = await pool.query(
    `SELECT d.id, d.arrival_id, d.original_name, d.mime_type, d.size_bytes, d.created_at
     FROM delivery_documents d
     WHERE d.arrival_id = ?
     ORDER BY d.id`,
    [arrivalId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.original_name,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    uploadedAt: toIso(r.created_at),
  }));
}

export async function fetchDeliveryDocument(docId, user) {
  const [rows] = await pool.query(
    `SELECT d.id, d.arrival_id, d.original_name, d.stored_name, d.mime_type, d.size_bytes, d.created_at, a.vendor_id
     FROM delivery_documents d
     JOIN arrivals a ON a.id = d.arrival_id
     WHERE d.id = ?`,
    [docId]
  );
  if (rows.length === 0) return null;
  const d = rows[0];
  assertVendorScope(d.vendor_id, user);
  return {
    id: Number(d.id),
    arrivalId: d.arrival_id,
    name: d.original_name,
    storedName: d.stored_name,
    mimeType: d.mime_type,
    sizeBytes: Number(d.size_bytes),
    uploadedAt: toIso(d.created_at),
  };
}

export async function insertDeliveryDocument(arrivalId, file, user) {
  await assertArrivalScope(arrivalId, user);
  const [res] = await pool.query(
    `INSERT INTO delivery_documents (arrival_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [arrivalId, file.originalname, file.filename, file.mimetype, file.size, user.sub]
  );
  await logAudit({
    user,
    action: "delivery.document.added",
    entityType: "arrival",
    entityId: arrivalId,
    detail: `Attached ${file.originalname} (${file.size} bytes) to Supply Chain delivery ${arrivalId}.`,
    ip: user?.ip ?? "",
  });
  return fetchDeliveryDocument(res.insertId, user);
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

/* Per-product receiving math for one arrival. Returns a Map keyed
   `product_name::unit` → {
     expected, good, originalGood, replacementGood, damaged, fulfilled
   }
   Damaged includes rejected items. Only 'good' is accepted stock; only original
   receipts define the replacement requirement. */
async function arrivalProductSums(conn, arrivalId) {
  const [arrItems] = await conn.query(
    "SELECT product_name, unit, qty FROM arrival_items WHERE arrival_id = ?",
    [arrivalId]
  );
  const map = new Map(
    arrItems.map((a) => [
      `${a.product_name}::${a.unit}`,
      {
        expected: Number(a.qty),
        good: 0,
        originalGood: 0,
        replacementGood: 0,
        damaged: 0,
        fulfilled: false,
      },
    ])
  );
  const [rips] = await conn.query(
    `SELECT ri.product_name, ri.unit, ri.condition_value,
            COALESCE(SUM(ri.qty), 0) AS qty,
            MAX(r.kind) AS kind
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     WHERE r.arrival_id = ?
     GROUP BY ri.product_name, ri.unit, ri.condition_value, r.kind
     HAVING SUM(ri.qty) > 0`,
    [arrivalId]
  );
  for (const row of rips) {
    const key = `${row.product_name}::${row.unit}`;
    const bucket = map.get(key);
    if (!bucket) continue;
    const qty = Number(row.qty);
    const kind = row.kind === "replacement" ? "replacement" : "original";
    if (row.condition_value === "good") bucket.good += qty;
    else bucket.damaged += qty;
    if (kind === "replacement") {
      if (row.condition_value === "good") bucket.replacementGood += qty;
    } else if (row.condition_value === "good") {
      bucket.originalGood += qty;
    }
  }
  for (const bucket of map.values()) {
    bucket.good = round3(bucket.good);
    bucket.originalGood = round3(bucket.originalGood);
    bucket.replacementGood = round3(bucket.replacementGood);
    bucket.damaged = round3(bucket.damaged);
    bucket.fulfilled = bucket.good >= bucket.expected;
  }
  return map;
}

/* Vendor Receiving acknowledgments per product for one arrival: total units the
   Vendor has acknowledged receiving so far (always against ACCEPTED stock; the
   accepted stock itself comes from the Checker/Inspection receipts). */
async function arrivalVendorAckSums(conn, arrivalId) {
  const [rows] = await conn.query(
    `SELECT product_name, unit, COALESCE(SUM(received_qty), 0) AS received
     FROM vendor_receiving_items
     WHERE arrival_id = ?
     GROUP BY product_name, unit`,
    [arrivalId]
  );
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.product_name}::${row.unit}`, Number(row.received));
  }
  return map;
}

/* Recompute the arrival's status from its ORIGINAL REQUIRED quantity and the
   cumulative VENDOR acknowledgments:
   - No inspection receipts at all → left untouched (still expected/reopened).
   - Cumulative vendor received <= 0                            → pending.
   - 0 < cumulative received < original required quantity      → partially_received.
   - Cumulative received >= original required quantity         → completed.
   The ORIGINAL required quantity (arrivals.total_qty, i.e. the sum of the
   arrival_items) is the only authority for status. The checker's accepted
   stock bounds how much the vendor CAN receive right now, but it must never be
   used as the completion target: a delivery that is short of its original
   requirement stays partially_received until the full original quantity has
   been acknowledged. */
async function syncArrivalStatus(conn, arrivalId) {
  const [arr] = await conn.query("SELECT id FROM arrivals WHERE id = ?", [arrivalId]);
  if (!arr) return;
  const [[anyReceipt]] = await conn.query(
    "SELECT COUNT(*) AS c FROM receipts WHERE arrival_id = ?",
    [arrivalId]
  );
  if (Number(anyReceipt.c) === 0) return;
  const sums = await arrivalProductSums(conn, arrivalId);
  const acks = await arrivalVendorAckSums(conn, arrivalId);
  let required = 0;
  let received = 0;
  for (const b of sums.values()) required += b.expected;
  for (const qty of acks.values()) received += qty;
  required = round3(required);
  received = round3(received);
  const status =
    received <= 0 ? "pending"
    : received >= required - 1e-9 ? "completed"
    : "partially_received";
  await conn.query("UPDATE arrivals SET status = ? WHERE id = ?", [status, arrivalId]);
}

/* ── Vendor Receiving acknowledgments ─────────────────────
   The Vendor acknowledges ACCEPTED stock (the checker result). The quantity a
   Vendor may receive is bound server-side to
       available = checker accepted − already acknowledged
   and partial receiving is supported: multiple acknowledgments can stack until
   every accepted unit is acknowledged, then the arrival becomes COMPLETED.
   The frontend always supplies an idempotency key (a client-generated receiving
   id) so a retried click / refresh can never create a duplicate transaction. */
const VRCEIVING_REF_PREFIX = "VRC";

export async function listVendorReceivings(user, { arrivalId } = {}) {
  const vendorId = vendorIdOf(user);
  const params = [vendorId];
  let arrivalClause = "";
  if (arrivalId) {
    arrivalClause = "AND vr.arrival_id = ?";
    params.push(arrivalId);
  }
  const [rows] = await pool.query(
    `SELECT vr.*, a.supplier_id AS a_supplier_id, a.supplier_name AS a_supplier_name, a.source_ref
     FROM vendor_receivings vr JOIN arrivals a ON a.id = vr.arrival_id
     WHERE vr.vendor_id = ? ${arrivalClause}
     ORDER BY vr.received_at DESC, vr.id DESC`,
    params
  );
  if (rows.length === 0) return [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ids = rows.map((r) => r.id).map(() => "?").join(",");
  const [items] = await pool.query(
    `SELECT * FROM vendor_receiving_items WHERE receiving_id IN (${ids}) ORDER BY id`,
    [...rows.map((r) => r.id)]
  );
  const byReceiving = new Map();
  for (const it of items) {
    if (!byReceiving.has(it.receiving_id)) byReceiving.set(it.receiving_id, []);
    byReceiving.get(it.receiving_id).push(it);
  }
  return rows.map((r) => mapVendorReceiving(r, byReceiving.get(r.id) ?? []));
}

export async function fetchVendorReceivingById(id, user) {
  const vendorId = vendorIdOf(user);
  const [rows] = await pool.query(
    `SELECT vr.*, a.supplier_id AS a_supplier_id, a.supplier_name AS a_supplier_name, a.source_ref
     FROM vendor_receivings vr JOIN arrivals a ON a.id = vr.arrival_id
     WHERE vr.id = ? AND vr.vendor_id = ?`,
    [id, vendorId]
  );
  if (rows.length === 0) return null;
  const [items] = await pool.query(
    "SELECT * FROM vendor_receiving_items WHERE receiving_id = ? ORDER BY id",
    [id]
  );
  return mapVendorReceiving(rows[0], items);
}

export async function createVendorReceiving(arrivalId, body, user) {
  const vendorId = vendorIdOf(user);
  /* The receiving/acknowledging identity comes from the authenticated account,
     never from a user id supplied by the client. */
  const receivedBy = (user?.displayName ?? user?.username ?? "").trim();
  const remarks = typeof body.remarks === "string" ? body.remarks.trim().slice(0, 500) : "";
  /* The official receiving timestamp is generated by the server. The UI may
     only preview the time; any value from the client is a preview that is
     replaced by the server time for the authoritative record. */
  const receivedAt = toDbDateTime(new Date());
  if (!receivedBy) throw httpError(400, "Your account has no name to record as the receiver. Ask an administrator to set your display name.");

  const items = Array.isArray(body.items) ? body.items : [];
  const cleanItems = [];
  const seen = new Set();
  for (const raw of items) {
    const productName = typeof raw?.productName === "string" ? raw.productName.trim() : "";
    const unit = typeof raw?.unit === "string" ? raw.unit.trim() : "";
    const qty = toNumber(raw?.qty);
    if (!productName || !unit) continue;
    if (qty === null || qty <= 0) continue;
    const key = `${productName}::${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleanItems.push({ productName, unit, qty: round3(qty) });
  }
  if (cleanItems.length === 0) {
    throw httpError(400, "Enter at least one line with a positive quantity to receive.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [arr] = await conn.query(
      "SELECT id, status, supplier_id, supplier_name, source_ref FROM arrivals WHERE id = ? AND vendor_id = ?",
      [arrivalId, vendorId]
    );
    if (arr.length === 0) throw httpError(403, "Unknown or unauthorized delivery reference.");

    /* Idempotency: if the client sent a receiving id that already exists for
       this delivery, it is a retried submission (double click / refresh after
       save) — return the existing record instead of creating a duplicate. */
    const clientId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : "";
    if (clientId && clientId.startsWith(VRCEIVING_REF_PREFIX)) {
      const [[existing]] = await conn.query(
        "SELECT COUNT(*) AS c FROM vendor_receivings WHERE id = ? AND arrival_id = ?",
        [clientId, arrivalId]
      );
      if (Number(existing.c) > 0) {
        await conn.commit();
        return fetchVendorReceivingById(clientId, user);
      }
    }

    /* The delivery must already carry a Checker result — the Vendor only ever
       acknowledges accepted stock, so it can never be the first to record it. */
    const [[anyInspection]] = await conn.query(
      "SELECT COUNT(*) AS c FROM receipts WHERE arrival_id = ?",
      [arrivalId]
    );
    if (Number(anyInspection.c) === 0) {
      throw httpError(400, "The delivery has not been inspected yet — there is no accepted stock to receive. Record the inspection result first.");
    }

    const sums = await arrivalProductSums(conn, arrivalId);
    const acks = await arrivalVendorAckSums(conn, arrivalId);

    let totalReceived = 0;
    const validated = [];
    for (const it of cleanItems) {
      const bucket = sums.get(`${it.productName}::${it.unit}`);
      if (!bucket || bucket.good <= 0) {
        throw httpError(400, `"${it.productName}" has no accepted (checked) stock to receive. It can only be received once the checker accepts it.`);
      }
      const accepted = bucket.good;
      const already = round3(acks.get(`${it.productName}::${it.unit}`) ?? 0);
      const available = round3(Math.max(0, accepted - already));
      if (available <= 0) {
        throw httpError(
          409,
          `All accepted stock for "${it.productName}" (${accepted} ${it.unit}) has already been received. Nothing remains to receive.`
        );
      }
      if (it.qty > available) {
        throw httpError(
          400,
          `Cannot receive ${it.qty} ${it.unit} — only ${available} ${it.unit} of accepted stock remains for "${it.productName}" (${accepted} ${it.unit} accepted, ${already} ${it.unit} already received).`
        );
      }
      validated.push({ ...it, accepted, available });
      totalReceived += it.qty;
    }

    const receivingId = clientId || genId(VRCEIVING_REF_PREFIX);
    await conn.query(
      `INSERT INTO vendor_receivings (id, arrival_id, received_by, received_at, remarks, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [receivingId, arrivalId, receivedBy, receivedAt, remarks, vendorId]
    );
    for (const it of validated) {
      await conn.query(
        `INSERT INTO vendor_receiving_items (receiving_id, arrival_id, product_name, unit, received_qty)
         VALUES (?, ?, ?, ?, ?)`,
        [receivingId, arrivalId, it.productName, it.unit, it.qty]
      );
    }

    const acks2 = await arrivalVendorAckSums(conn, arrivalId);
    let requiredTotal = 0;
    let receivedTotal = 0;
    for (const b of sums.values()) requiredTotal += b.expected;
    for (const qty of acks2.values()) receivedTotal += qty;
    requiredTotal = round3(requiredTotal);
    receivedTotal = round3(receivedTotal);
    const isComplete = receivedTotal >= requiredTotal - 1e-9;

    await syncArrivalStatus(conn, arrivalId);
    await createNotification(conn, {
      title: "Vendor Receiving Confirmed",
      message:
        `${arr[0].supplier_name} — ${totalReceived} ${cleanItems.length > 1 ? "line items" : `${cleanItems[0].qty} ${cleanItems[0].unit}`} acknowledged on ${arrivalId} (${receivingId}). ` +
        (isComplete ? "All required stock received." : `Received ${receivedTotal} of ${requiredTotal} required units.`),
      type: "success",
      vendorId,
      recipient: "all",
    });
    await logAudit({
      conn,
      user,
      action: "vendor_receiving.confirmed",
      entityType: "arrival",
      entityId: arrivalId,
      detail: `Confirmed Vendor receiving on ${arrivalId}: ${validated.map((v) => `${v.qty} ${v.unit} "${v.productName}"`).join(", ")} (${receivingId}). ${isComplete ? "All required stock received." : `Received ${receivedTotal} of ${requiredTotal} required units.`}`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return fetchVendorReceivingById(receivingId, user);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function createNotification(conn, notif) {
  await conn.query(
    "INSERT INTO notifications (id, title, message, type, is_read, vendor_id, recipient, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
    [genNotifId(), notif.title, notif.message, notif.type, notif.vendorId ?? "", notif.recipient ?? "all", toDbDateTime(new Date())]
  );
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
  const role = user.role ?? "all";
  const [res] = await pool.query(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND vendor_id = ? AND (recipient = 'all' OR recipient = ?)",
    [id, vendorIdOf(user), role]
  );
  if (res.affectedRows === 0) throw httpError(404, "Notification not found.");

  const [rows] = await pool.query(
    "SELECT * FROM notifications WHERE id = ? AND vendor_id = ?",
    [id, vendorIdOf(user)]
  );
  if (rows.length === 0) throw httpError(404, "Notification not found.");
  return mapNotification(rows[0]);
}

export async function markAllNotificationsRead(user) {
  const role = user.role ?? "all";
  await pool.query(
    "UPDATE notifications SET is_read = 1 WHERE vendor_id = ? AND (recipient = 'all' OR recipient = ?)",
    [vendorIdOf(user), role]
  );
  return { ok: true };
}

export async function clearNotifications(user) {
  const role = user.role ?? "all";
  await pool.query(
    "DELETE FROM notifications WHERE vendor_id = ? AND (recipient = 'all' OR recipient = ?)",
    [vendorIdOf(user), role]
  );
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
      recipient: "admin",
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
export async function fetchDashboard(user) {
  const vendorId = vendorIdOf(user);
  const [suppliers, arrivals, receipts, notifications] = await Promise.all([
    loadSuppliers(vendorId),
    loadArrivals(vendorId),
    loadReceipts(vendorId),
    loadNotifications(vendorId, user.role ?? "all"),
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

/* ── supplier applications & sourcing workflow ─────────── */

const pad5 = (n) => String(n).padStart(5, "0");

async function nextApplicationReference(conn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const year = new Date().getFullYear();
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) AS c FROM supplier_applications WHERE id LIKE ?",
      [`APP-${year}-%`]
    );
    const ref = `APP-${year}-${pad5(c + 1)}`;
    const [collision] = await conn.query("SELECT id FROM supplier_applications WHERE id = ?", [ref]);
    if (collision.length === 0) return ref;
  }
  throw httpError(409, "Could not generate a unique application reference. Please retry.");
}

async function nextSupplierReference(conn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const year = new Date().getFullYear();
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) AS c FROM suppliers WHERE id LIKE ?",
      [`SUP-${year}-%`]
    );
    const ref = `SUP-${year}-${pad5(c + 1)}`;
    const [collision] = await conn.query("SELECT id FROM suppliers WHERE id = ?", [ref]);
    if (collision.length === 0) return ref;
  }
  throw httpError(409, "Could not generate a unique supplier reference. Please retry.");
}

export function validateSupplierApplicationPayload(body) {
  const errors = {};
  const s = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const companyName = s(body.companyName, 180);
  if (!companyName) errors.companyName = "Company name is required.";

  const businessRegNo = s(body.businessRegNo, 80);
  if (!businessRegNo) errors.businessRegNo = "Business registration number is required.";

  const tin = s(body.tin, 60);
  if (!tin) errors.tin = "TIN is required.";

  const address = s(body.address, 255);
  if (!address) errors.address = "Company address is required.";

  const email = s(body.email, 160).toLowerCase();
  if (!email) errors.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";

  const phone = s(body.phone, 60);
  if (!phone) errors.phone = "Phone number is required.";

  const website = s(body.website, 160);
  const distributionArea = s(body.distributionArea, 255);
  if (!distributionArea) errors.distributionArea = "Distribution area is required.";

  const contactName = s(body.contactName, 120);
  if (!contactName) errors.contactName = "Contact person is required.";

  const contactPosition = s(body.contactPosition, 120);
  if (!contactPosition) errors.contactPosition = "Contact position / title is required.";

  const supplierType = s(body.supplierType, 30);
  if (!SUPPLIER_TYPES.includes(supplierType)) errors.supplierType = "Select a valid supplier type.";

  const yearsInBusiness =
    body.yearsInBusiness === "" || body.yearsInBusiness === null || body.yearsInBusiness === undefined
      ? null
      : Number(body.yearsInBusiness);
  if (
    yearsInBusiness !== null &&
    (!Number.isInteger(yearsInBusiness) || yearsInBusiness < 0 || yearsInBusiness > 200)
  ) {
    errors.yearsInBusiness = "Years in business must be a whole number from 0 to 200.";
  }

  const products = [];
  if (!Array.isArray(body.products) || body.products.length === 0) {
    errors.products = "Add at least one product / supply you can offer.";
  } else if (body.products.length > 15) {
    errors.products = "An application can list at most 15 products.";
  } else {
    for (let i = 0; i < body.products.length; i++) {
      const raw = body.products[i] ?? {};
      const name = s(raw.name, 180);
      const category = s(raw.category, 60);
      if (!name) { errors.products = `Product ${i + 1}: product name is required.`; break; }
      if (!category) { errors.products = `Product ${i + 1}: select a category.`; break; }
      products.push({
        name,
        category,
        description: s(raw.description, 500),
        brand: s(raw.brand, 160),
        supplyCapacity: s(raw.supplyCapacity, 120),
        minOrderQty: s(raw.minOrderQty, 120),
        priceRange: s(raw.priceRange, 120),
        unit: s(raw.unit, 20),
      });
    }
  }

  if (Object.keys(errors).length > 0) {
    const keys = [
      "companyName", "businessRegNo", "tin", "address", "email", "phone",
      "distributionArea", "contactName", "contactPosition", "supplierType",
      "yearsInBusiness", "products",
    ];
    const message = keys.map((k) => errors[k]).find(Boolean) ?? errors[Object.keys(errors)[0]];
    throw httpError(400, message, { errors });
  }

  return {
    companyName, businessRegNo, tin, address, email, phone, website,
    distributionArea, contactName, contactPosition, supplierType, yearsInBusiness, products,
  };
}

async function loadApplication(id) {
  const [rows] = await pool.query("SELECT * FROM supplier_applications WHERE id = ?", [id]);
  if (rows.length === 0) return null;
  const [products] = await pool.query(
    "SELECT * FROM application_products WHERE application_id = ? ORDER BY id", [id]
  );
  const [docs] = await pool.query(
    "SELECT id, original_name, stored_name, mime_type, size_bytes, created_at FROM application_documents WHERE application_id = ? ORDER BY created_at, id",
    [id]
  );
  const [timeline] = await pool.query(
    "SELECT id, action, actor, note, created_at FROM application_timeline WHERE application_id = ? ORDER BY created_at, id",
    [id]
  );
  return mapApplication(rows[0], {
    products: products.map((p) => ({
      name: p.name,
      category: p.category,
      description: p.description,
      brand: p.brand,
      supplyCapacity: p.supply_capacity,
      minOrderQty: p.min_order_qty,
      priceRange: p.price_range,
      unit: p.unit,
    })),
    documents: docs.map((d) => ({
      id: d.id,
      originalName: d.original_name,
      storedName: d.stored_name,
      mimeType: d.mime_type,
      sizeBytes: Number(d.size_bytes),
      createdAt: toIso(d.created_at),
    })),
    timeline: timeline.map((t) => ({
      id: t.id,
      action: t.action,
      actor: t.actor,
      note: t.note,
      date: toIso(t.created_at),
    })),
  });
}

async function insertApplicationFiles(conn, applicationId, files) {
  for (const f of files) {
    await conn.query(
      "INSERT INTO application_documents (id, application_id, original_name, stored_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), applicationId, f.originalName, f.storedName, f.mimeType, f.sizeBytes]
    );
  }
}

export async function createSupplierApplication(parsed, files, user = null) {
  const vendorId = DEFAULT_VENDOR_ID;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = await nextApplicationReference(conn);
    await conn.query(
      `INSERT INTO supplier_applications
        (id, vendor_id, company_name, business_reg_no, tin, address, email, phone, website,
         distribution_area, contact_name, contact_position, supplier_type, years_in_business,
         status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', NOW())`,
      [id, vendorId, parsed.companyName, parsed.businessRegNo, parsed.tin, parsed.address, parsed.email,
        parsed.phone, parsed.website, parsed.distributionArea, parsed.contactName, parsed.contactPosition,
        parsed.supplierType, parsed.yearsInBusiness]
    );
    for (const p of parsed.products) {
      await conn.query(
        `INSERT INTO application_products
          (application_id, name, category, description, brand, supply_capacity, min_order_qty, price_range, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.name, p.category, p.description, p.brand, p.supplyCapacity, p.minOrderQty, p.priceRange, p.unit]
      );
    }
    await insertApplicationFiles(conn, id, files);
    await conn.query(
      "INSERT INTO application_timeline (application_id, action, actor, note, created_at) VALUES (?, ?, ?, ?, NOW())",
      [id, "Application Submitted", parsed.contactName || parsed.companyName, `${parsed.companyName} submitted a supplier application.`]
    );
    await createNotification(conn, {
      title: "New Supplier Application",
      message: `${parsed.companyName} submitted a new supplier application (${id}).`,
      type: "info",
      vendorId,
      recipient: "admin",
    });
    await logAudit({
      conn,
      user: user ?? { vendorId, sub: null },
      action: "application.submit",
      entityType: "supplier_application",
      entityId: id,
      detail: `Application received from ${parsed.companyName} (${parsed.products.length} product line(s), ${files.length} document(s)).`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return loadApplication(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function lookupApplicationStatus(id, email) {
  const [rows] = await pool.query(
    "SELECT * FROM supplier_applications WHERE id = ? AND LOWER(email) = LOWER(?)",
    [id, email ?? ""]
  );
  if (rows.length === 0) return null;
  const app = await loadApplication(id);
  if (!app) return null;
  /* Public lookups only expose identity, status, notes, and the timeline. */
  const { products, documents, ...rest } = app;
  return rest;
}

export async function fetchApplications(user) {
  const vendorId = vendorIdOf(user);
  const [rows] = await pool.query(
    "SELECT id FROM supplier_applications WHERE vendor_id = ? ORDER BY submitted_at DESC, id DESC",
    [vendorId]
  );
  const out = [];
  for (const { id } of rows) {
    const app = await loadApplication(id);
    if (app) out.push(app);
  }
  return out;
}

export async function fetchApplicationById(id, user) {
  const [rows] = await pool.query("SELECT * FROM supplier_applications WHERE id = ?", [id]);
  if (rows.length === 0) return null;
  assertVendorScope(rows[0].vendor_id, user);
  return loadApplication(id);
}

export async function fetchApplicationDocument(appId, docId, user) {
  const [rows] = await pool.query("SELECT a.vendor_id FROM supplier_applications a WHERE a.id = ?", [appId]);
  if (rows.length === 0) throw httpError(404, "Supplier application not found.");
  assertVendorScope(rows[0].vendor_id, user);
  const [docs] = await pool.query(
    "SELECT * FROM application_documents WHERE id = ? AND application_id = ?",
    [docId, appId]
  );
  if (docs.length === 0) throw httpError(404, "Document not found.");
  return docs[0];
}

async function runApplicationTransition(id, user, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM supplier_applications WHERE id = ?", [id]);
    if (rows.length === 0) throw httpError(404, "Supplier application not found.");
    assertVendorScope(rows[0].vendor_id, user);
    await fn(conn, rows[0]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function timelineEntry(conn, applicationId, action, actor, note) {
  return conn.query(
    "INSERT INTO application_timeline (application_id, action, actor, note, created_at) VALUES (?, ?, ?, ?, NOW())",
    [applicationId, action, actor, note]
  );
}

export async function setApplicationUnderReview(id, user) {
  await runApplicationTransition(id, user, async (conn, row) => {
    if (row.status !== "pending_review") {
      throw httpError(409, "Only pending applications can be moved to under review.");
    }
    await conn.query("UPDATE supplier_applications SET status = 'under_review' WHERE id = ?", [id]);
    await timelineEntry(conn, id, "Status Changed to Under Review", user?.username ?? "Admin", "Application is now under review.");
    await createNotification(conn, {
      title: "Application Under Review",
      message: `${row.company_name} (${id}) is now under review.`,
      type: "info",
      vendorId: row.vendor_id,
      recipient: "admin",
    });
    await logAudit({
      conn, user,
      action: "application.under_review",
      entityType: "supplier_application",
      entityId: id,
      detail: `Moved ${id} (${row.company_name}) to Under Review.`,
      ip: user?.ip ?? "",
    });
  });
  return fetchApplicationById(id, user);
}

export async function rejectApplication(id, reason, user) {
  const note = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";
  if (!note) throw httpError(400, "A rejection reason is required.");
  await runApplicationTransition(id, user, async (conn, row) => {
    if (row.status === "approved") throw httpError(409, "This application is already approved.");
    if (row.status === "rejected") throw httpError(409, "This application was already rejected.");
    await conn.query(
      "UPDATE supplier_applications SET status = 'rejected', rejection_reason = ? WHERE id = ?",
      [note, id]
    );
    await timelineEntry(conn, id, "Application Rejected", user?.username ?? "Admin", note);
    await createNotification(conn, {
      title: "Application Rejected",
      message: `${row.company_name} (${id}) has been rejected.`,
      type: "error",
      vendorId: row.vendor_id,
      recipient: "admin",
    });
    await logAudit({
      conn, user,
      action: "application.reject",
      entityType: "supplier_application",
      entityId: id,
      detail: `Rejected ${id}: ${note}`,
      ip: user?.ip ?? "",
    });
  });
  return fetchApplicationById(id, user);
}

export async function requestApplicationRevision(id, note, user) {
  const text = typeof note === "string" ? note.trim().slice(0, 1000) : "";
  if (!text) throw httpError(400, "A revision note is required.");
  await runApplicationTransition(id, user, async (conn, row) => {
    if (row.status === "approved") throw httpError(409, "This application is already approved.");
    if (row.status === "revision_required") throw httpError(409, "This application already requires revision.");
    await conn.query(
      "UPDATE supplier_applications SET status = 'revision_required', revision_note = ? WHERE id = ?",
      [text, id]
    );
    await timelineEntry(conn, id, "Revision Required", user?.username ?? "Admin", text);
    await createNotification(conn, {
      title: "Revision Required",
      message: `${row.company_name} (${id}) has been asked to revise and resubmit.`,
      type: "warning",
      vendorId: row.vendor_id,
      recipient: "admin",
    });
    await logAudit({
      conn, user,
      action: "application.revision",
      entityType: "supplier_application",
      entityId: id,
      detail: `Revision required for ${id}: ${text}`,
      ip: user?.ip ?? "",
    });
  });
  return fetchApplicationById(id, user);
}

export async function approveApplication(id, user) {
  const vendorId = vendorIdOf(user);
  let supplierId = "";
  await runApplicationTransition(id, user, async (conn, row) => {
    if (row.status === "approved") throw httpError(409, "This application is already approved.");
    if (row.status === "rejected") throw httpError(409, "A rejected application can no longer be approved.");
    supplierId = await nextSupplierReference(conn);
    const app = await loadApplication(id);
    await conn.query(
      `INSERT INTO suppliers
        (id, source_ref, vendor_id, company_name, contact_name, contact_email, contact_phone,
         supplier_type, address, email, phone, website, distribution_area, status, established_on,
         source_application_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURDATE(), ?)`,
      [supplierId, id, row.vendor_id, row.company_name, row.contact_name, row.email, row.phone,
        row.supplier_type, row.address, row.email, row.phone, row.website ?? "",
        row.distribution_area ?? "", id]
    );
    for (const p of app.products) {
      await conn.query(
        "INSERT INTO supplier_products (supplier_id, name, description, brand, category) VALUES (?, ?, ?, ?, ?)",
        [supplierId, p.name, p.description, p.brand, p.category]
      );
    }
    await conn.query(
      "UPDATE supplier_applications SET status = 'approved', approved_supplier_id = ?, revision_note = '', rejection_reason = '' WHERE id = ?",
      [supplierId, id]
    );
    await timelineEntry(
      conn, id, "Application Approved", user?.username ?? "Admin",
      `All requirements met. Supplier ID ${supplierId} generated and added to Supplier Management.`
    );
    await createNotification(conn, {
      title: "Supplier Approved",
      message: `${row.company_name} approved as an official Tri-M supplier (${supplierId}).`,
      type: "success",
      vendorId: row.vendor_id,
      recipient: "admin",
    });
    await logAudit({
      conn, user,
      action: "application.approve",
      entityType: "supplier_application",
      entityId: id,
      detail: `Application approved. Supplier record created: ${supplierId}.`,
      ip: user?.ip ?? "",
    });
    await logAudit({
      conn,
      user: { sub: null, vendorId: row.vendor_id },
      action: "supplier.create",
      entityType: "supplier",
      entityId: supplierId,
      detail: `Official supplier record auto-generated from application ${id}.`,
      ip: "",
    });
    });
  return fetchSupplierById(supplierId, vendorId);
}

export async function resubmitSupplierApplication(id, email, parsed, files, user = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await pool.query(
      "SELECT * FROM supplier_applications WHERE id = ? AND LOWER(email) = LOWER(?)",
      [id, email ?? ""]
    );
    if (rows.length === 0) throw httpError(404, "Application not found. Check your Application ID and email.");
    const row = rows[0];
    if (row.status !== "revision_required") {
      throw httpError(409, "This application is not open for resubmission.");
    }
    await conn.query("DELETE FROM application_products WHERE application_id = ?", [id]);
    await conn.query("DELETE FROM application_documents WHERE application_id = ?", [id]);
    await conn.query(
      `UPDATE supplier_applications
        SET company_name = ?, business_reg_no = ?, tin = ?, address = ?, email = ?, phone = ?,
            website = ?, distribution_area = ?, contact_name = ?, contact_position = ?,
            supplier_type = ?, years_in_business = ?, status = 'pending_review', revision_note = ''
       WHERE id = ?`,
      [parsed.companyName, parsed.businessRegNo, parsed.tin, parsed.address, parsed.email, parsed.phone,
        parsed.website, parsed.distributionArea, parsed.contactName, parsed.contactPosition,
        parsed.supplierType, parsed.yearsInBusiness, id]
    );
    for (const p of parsed.products) {
      await conn.query(
        `INSERT INTO application_products
          (application_id, name, category, description, brand, supply_capacity, min_order_qty, price_range, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.name, p.category, p.description, p.brand, p.supplyCapacity, p.minOrderQty, p.priceRange, p.unit]
      );
    }
    await insertApplicationFiles(conn, id, files);
    await timelineEntry(conn, id, "Application Resubmitted", parsed.contactName || parsed.companyName, "Revised application submitted for review.");
    await createNotification(conn, {
      title: "Application Resubmitted",
      message: `${parsed.companyName} has resubmitted application ${id} for review.`,
      type: "info",
      vendorId: row.vendor_id,
      recipient: "admin",
    });
    await logAudit({
      conn,
      user: user ?? { vendorId: row.vendor_id, sub: null },
      action: "application.resubmit",
      entityType: "supplier_application",
      entityId: id,
      detail: `Application ${id} resubmitted after revision (${parsed.products.length} product line(s), ${files.length} document(s)).`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return loadApplication(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ── evaluations & performance ─────────────────────────── */

export async function fetchEvaluations(user) {
  const vendorId = vendorIdOf(user);
  const [rows] = await pool.query(
    `SELECT e.*, s.company_name AS supplier_name
     FROM evaluations e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.vendor_id = ?
     ORDER BY e.created_at DESC, e.id DESC`,
    [vendorId]
  );
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.supplier_id)) continue;
    seen.add(row.supplier_id);
    const [criteria] = await pool.query(
      "SELECT criterion, label, weight, score FROM evaluation_criteria WHERE evaluation_id = ? ORDER BY id",
      [row.id]
    );
    out.push(mapEvaluation(row, criteria));
  }
  return out;
}

export async function saveEvaluation({ supplierId, comment, scores }, user) {
  const vendorId = vendorIdOf(user);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await pool.query(
      "SELECT id, company_name FROM suppliers WHERE id = ? AND vendor_id = ?",
      [supplierId, vendorId]
    );
    if (rows.length === 0) throw httpError(403, "Unknown or unauthorized supplier reference.");
    const cleaned = EVALUATION_CRITERIA.map((c) => {
      const value = Number(scores?.[c.key]);
      const score = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
      return { ...c, score };
    });
    const [res] = await conn.query(
      "INSERT INTO evaluations (supplier_id, evaluator_id, comment) VALUES (?, ?, ?)",
      [supplierId, user?.sub ?? null, typeof comment === "string" ? comment.trim().slice(0, 1000) : ""]
    );
    const evaluationId = res.insertId;
    for (const c of cleaned) {
      await conn.query(
        "INSERT INTO evaluation_criteria (evaluation_id, criterion, label, weight, score) VALUES (?, ?, ?, ?, ?)",
        [evaluationId, c.key, c.label, c.weight, c.score]
      );
    }
    const total = cleaned.reduce((a, c) => a + (c.weight * c.score) / 100, 0);
    const totalRounded = Math.round(total * 100) / 100;
    await conn.query(
      "UPDATE suppliers SET evaluation_score = ?, performance_rating = ?, last_evaluated = NOW() WHERE id = ?",
      [totalRounded, Math.round((totalRounded / 10) * 10) / 10, supplierId]
    );
    await createNotification(conn, {
      title: "Supplier Evaluation Saved",
      message: `${rows[0].company_name} evaluated (score ${totalRounded}/100).`,
      type: "success",
      vendorId,
      recipient: "admin",
    });
    await logAudit({
      conn, user,
      action: "evaluation.save",
      entityType: "evaluation",
      entityId: String(evaluationId),
      detail: `Evaluated ${rows[0].company_name} (${supplierId}): ${totalRounded}/100.`,
      ip: user?.ip ?? "",
    });
    await conn.commit();
    return { ok: true, id: evaluationId, supplierId, total: totalRounded };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* Performance metrics are DERIVED from real receiving data plus the latest
   evaluation — never guessed or hardcoded. */
export async function fetchPerformance(user) {
  const vendorId = vendorIdOf(user);
  const [rows] = await pool.query(
    `SELECT s.id, s.company_name, s.supplier_type, s.status, s.evaluation_score,
            s.performance_rating, s.last_evaluated
     FROM suppliers s WHERE s.vendor_id = ? ORDER BY s.company_name`,
    [vendorId]
  );
  const [receiptAgg] = await pool.query(
    `SELECT supplier_id,
            COUNT(*) AS receipt_count,
            COALESCE(SUM(total_qty), 0) AS total_received,
            COALESCE(SUM(CASE WHEN condition_value <> 'good' THEN qty ELSE 0 END), 0) AS issue_qty
     FROM receipts r
     LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
     WHERE r.vendor_id = ?
     GROUP BY supplier_id`,
    [vendorId]
  );
  const bySupplier = new Map(receiptAgg.map((r) => [r.supplier_id, r]));
  const [history] = await pool.query(
    `SELECT e.supplier_id, s.evaluation_score AS latest
     FROM evaluations e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.vendor_id = ? AND e.id IN (SELECT MAX(id) FROM evaluations GROUP BY supplier_id)`,
    [vendorId]
  );
  const prevBest = new Map();
  for (const h of history) {
    const [prev] = await pool.query(
      "SELECT e.id FROM evaluations e WHERE e.supplier_id = ? AND e.id < (SELECT MAX(id) FROM evaluations e2 WHERE e2.supplier_id = e.supplier_id) ORDER BY e.id DESC LIMIT 1",
      [h.supplier_id]
    );
    if (prev.length > 0) {
      const [[agg]] = await pool.query(
        "SELECT SUM(weight * score) / 100 AS total FROM evaluation_criteria WHERE evaluation_id = ?",
        [prev[0].id]
      );
      prevBest.set(h.supplier_id, Number(agg?.total ?? 0));
    }
  }
  return rows.map((s) => {
    const agg = bySupplier.get(s.id);
    const totalReceived = Number(agg?.total_received ?? 0);
    const issueQty = Number(agg?.issue_qty ?? 0);
    const issueRate = totalReceived > 0 ? Math.round((issueQty / totalReceived) * 1000) / 10 : 0;
    const evalScore = s.evaluation_score == null ? 0 : Number(s.evaluation_score);
    const prev = prevBest.get(s.id);
    const trend = prev !== undefined && prev > 0 ? Math.round((evalScore - prev) * 10) / 10 : null;
    return {
      id: s.id,
      companyName: s.company_name,
      supplierType: s.supplier_type,
      status: s.status,
      receiptCount: Number(agg?.receipt_count ?? 0),
      totalReceived,
      issueRate,
      issueQty,
      evaluationScore: evalScore,
      performanceRating: s.performance_rating == null ? 0 : Number(s.performance_rating),
      lastEvaluated: s.last_evaluated ? toIso(s.last_evaluated) : "",
      trend,
    };
  });
}

export async function fetchAuditLogs(user) {
  const vendorId = vendorIdOf(user);
  const [rows] = await pool.query(
    `SELECT al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.detail, al.created_at,
            u.username AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE al.vendor_id = ?
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT 500`,
    [vendorId]
  );
  return rows.map(mapAuditLog);
}
