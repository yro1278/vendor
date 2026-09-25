import bcrypt from "bcryptjs";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pool } from "./pool.js";
import { DEFAULT_VENDOR_ID } from "./constants.js";

const pad = (n) => String(n).padStart(2, "0");

const dateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const day = (offset, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const dtStr = (d) => `${dateOnly(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

const isoToDb = (s) => {
  const d = new Date(s);
  if (Number.isNaN(+d)) return s;
  return dtStr(d);
};

const SEED_SUPPLIERS = [
  {
    id: "SUP-2026-10001",
    sourceRef: "SCSUP-2026-0140",
    companyName: "BeautyPH Cosmetics Inc.",
    contactName: "Ana Reyes",
    contactEmail: "a.reyes@beautyphcosmetics.com",
    contactPhone: "+63 920 543 2109",
    supplierType: "Importer",
    address: "78 Shaw Blvd, Mandaluyong City, Metro Manila",
    email: "sales@beautyphcosmetics.com",
    phone: "+63 2 6666 3333",
    website: "www.beautyphcosmetics.com",
    distributionArea: "Metro Manila, Cebu, Davao",
    status: "active",
    establishedOn: dateOnly(day(-100)),
  },
  {
    id: "SUP-2026-10032",
    sourceRef: "SCSUP-2026-0131",
    companyName: "Pacific Dry Goods Trading",
    contactName: "Marco Santos",
    contactEmail: "marco@pacificdry.ph",
    contactPhone: "+63 917 812 3456",
    supplierType: "Wholesaler",
    address: "12 Harbor Drive, Port Area, Manila",
    email: "marco@pacificdry.ph",
    phone: "+63 2 8888 1111",
    website: "www.pacificdry.ph",
    distributionArea: "Metro Manila, Luzon",
    status: "active",
    establishedOn: dateOnly(day(-80)),
  },
  {
    id: "SUP-2026-10045",
    sourceRef: "SCSUP-2026-0156",
    companyName: "Pacific Fresh Distributors Inc.",
    contactName: "Maria Santos",
    contactEmail: "maria.santos@pacificfresh.ph",
    contactPhone: "+63 917 123 4567",
    supplierType: "Distributor",
    address: "45 Macapagal Blvd, Pasay City, Metro Manila",
    email: "info@pacificfresh.ph",
    phone: "+63 2 8888 5555",
    website: "www.pacificfresh.ph",
    distributionArea: "Metro Manila, Luzon",
    status: "active",
    establishedOn: dateOnly(day(-45)),
  },
];

const SEED_PRODUCTS = [
  { supplierId: "SUP-2026-10001", name: "Korean BB Cream SPF 50+", description: "Multi-function BB cream with sun protection and moisturizing formula.", brand: "GlowKor", category: "Cosmetic Products" },
  { supplierId: "SUP-2026-10001", name: "Hyaluronic Acid Serum 30ml", description: "2% HA serum with panthenol and ceramide complex for intense hydration.", brand: "GlowKor", category: "Cosmetic Products" },
  { supplierId: "SUP-2026-10001", name: "Matte Lipstick Trio", description: "Long-wear matte lipstick set in three shades.", brand: "GlowKor", category: "Cosmetic Products" },
  { supplierId: "SUP-2026-10032", name: "Premium Jasmine Rice 25kg", description: "Premium long-grain jasmine rice in sealed 25kg sacks.", brand: "Pacific Dry", category: "Dry Products" },
  { supplierId: "SUP-2026-10032", name: "Canned Sardines 155g", description: "Canned sardines in tomato sauce, 155g.", brand: "Pacific Dry", category: "Dry Products" },
  { supplierId: "SUP-2026-10045", name: "Premium Frozen Tilapia Fillet", description: "Grade A frozen tilapia fillets, IQF processed, sizes 100–200g.", brand: "Pacific Fresh", category: "Frozen Products" },
  { supplierId: "SUP-2026-10045", name: "Frozen Shrimp Vannamei (HLSO)", description: "Head-less shell-on frozen shrimp, various count sizes available.", brand: "Pacific Fresh", category: "Frozen Products" },
];

const SEED_ARRIVALS = [
  {
    id: "SC-DLV-2026-0311",
    sourceRef: "SC-SCHED-2026-0311",
    supplierId: "SUP-2026-10001",
    supplierName: "BeautyPH Cosmetics Inc.",
    items: [
      { productName: "Korean BB Cream SPF 50+", qty: 200, unit: "pcs" },
      { productName: "Hyaluronic Acid Serum 30ml", qty: 120, unit: "pcs" },
    ],
    totalQty: 320,
    expectedDate: dateOnly(day(-1)),
    expectedTime: "10:00 AM",
    destination: "Tri-M MDC — Warehouse A",
    remarks: "",
    status: "completed",
    created: isoToDb(day(-6, 9)),
  },
  {
    id: "SC-DLV-2026-0334",
    sourceRef: "SC-SCHED-2026-0334",
    supplierId: "SUP-2026-10032",
    supplierName: "Pacific Dry Goods Trading",
    items: [{ productName: "Premium Jasmine Rice 25kg", qty: 100, unit: "sack" }],
    totalQty: 100,
    expectedDate: dateOnly(day(0)),
    expectedTime: "9:00 AM",
    destination: "Tri-M MDC — Warehouse A",
    remarks: "Delivery truck arrived at site.",
    status: "pending",
    created: isoToDb(day(-2, 9)),
  },
  {
    id: "SC-DLV-2026-0338",
    sourceRef: "SC-SCHED-2026-0338",
    supplierId: "SUP-2026-10045",
    supplierName: "Pacific Fresh Distributors Inc.",
    items: [
      { productName: "Premium Frozen Tilapia Fillet", qty: 300, unit: "kg" },
      { productName: "Frozen Shrimp Vannamei (HLSO)", qty: 200, unit: "kg" },
    ],
    totalQty: 500,
    expectedDate: dateOnly(day(1)),
    expectedTime: "8:30 AM",
    destination: "Tri-M MDC — Cold Storage",
    remarks: "",
    status: "expected",
    created: isoToDb(day(-1, 9)),
  },
  {
    id: "SC-DLV-2026-0298",
    sourceRef: "SC-SCHED-2026-0298",
    supplierId: "SUP-2026-10032",
    supplierName: "Pacific Dry Goods Trading",
    items: [{ productName: "Canned Sardines 155g", qty: 2000, unit: "pcs" }],
    totalQty: 2000,
    expectedDate: dateOnly(day(-3)),
    expectedTime: "2:00 PM",
    destination: "Tri-M MDC — Warehouse A",
    remarks: "Balance of 400 pcs pending from supplier.",
    status: "partially_received",
    created: isoToDb(day(-4, 9)),
  },
  {
    id: "SC-DLV-2026-0287",
    sourceRef: "SC-SCHED-2026-0287",
    supplierId: "SUP-2026-10001",
    supplierName: "BeautyPH Cosmetics Inc.",
    items: [{ productName: "Matte Lipstick Trio", qty: 120, unit: "pcs" }],
    totalQty: 120,
    expectedDate: dateOnly(day(-2)),
    expectedTime: "11:00 AM",
    destination: "Tri-M MDC — Warehouse A",
    remarks: "Physical count verified.",
    status: "completed",
    created: isoToDb(day(-3, 9)),
  },
  {
    id: "SC-DLV-2026-0272",
    sourceRef: "SC-SCHED-2026-0272",
    supplierId: "SUP-2026-10045",
    supplierName: "Pacific Fresh Distributors Inc.",
    items: [{ productName: "Frozen Shrimp Vannamei (HLSO)", qty: 150, unit: "kg" }],
    totalQty: 150,
    expectedDate: dateOnly(day(-4)),
    expectedTime: "7:30 AM",
    destination: "Tri-M MDC — Cold Storage",
    remarks: "Cold chain broke in transit; returned to supplier; replacement scheduled.",
    status: "pending",
    created: isoToDb(day(-5, 9)),
  },
];

const SEED_RECEIPTS = [
  {
    id: "RR-2026-0081",
    arrivalId: "SC-DLV-2026-0311",
    supplierId: "SUP-2026-10001",
    supplierName: "BeautyPH Cosmetics Inc.",
    items: [
      { productName: "Korean BB Cream SPF 50+", qty: 200, unit: "pcs", condition: "good", totalReceived: 200 },
      { productName: "Hyaluronic Acid Serum 30ml", qty: 120, unit: "pcs", condition: "good", totalReceived: 120 },
    ],
    totalQty: 320,
    receivedAt: isoToDb(day(-1, 14)),
    receivingBy: "R. Dela Cruz",
    docRef: "DR-2026-5881",
    remarks: "Completed receiving; forwarded to inventory.",
  },
  {
    id: "RR-2026-0078",
    arrivalId: "SC-DLV-2026-0298",
    supplierId: "SUP-2026-10032",
    supplierName: "Pacific Dry Goods Trading",
    items: [{ productName: "Canned Sardines 155g", qty: 1500, unit: "pcs", condition: "good", totalReceived: 1500 }],
    totalQty: 1500,
    receivedAt: isoToDb(day(-3, 14)),
    receivingBy: "R. Dela Cruz",
    docRef: "DR-2026-5871",
    remarks: "Received 1500 of 2000 pcs; balance pending.",
  },
  {
    id: "RR-2026-0075",
    arrivalId: "SC-DLV-2026-0287",
    supplierId: "SUP-2026-10001",
    supplierName: "BeautyPH Cosmetics Inc.",
    items: [{ productName: "Matte Lipstick Trio", qty: 120, unit: "pcs", condition: "good", totalReceived: 120 }],
    totalQty: 120,
    receivedAt: isoToDb(day(-2, 11)),
    receivingBy: "K. Banag",
    docRef: "DR-2026-5866",
    remarks: "Count and condition verified, pending final confirmation.",
  },
  {
    id: "RR-2026-0072",
    arrivalId: "SC-DLV-2026-0272",
    supplierId: "SUP-2026-10045",
    supplierName: "Pacific Fresh Distributors Inc.",
    items: [{ productName: "Frozen Shrimp Vannamei (HLSO)", qty: 150, unit: "kg", condition: "rejected", totalReceived: 150 }],
    totalQty: 150,
    receivedAt: isoToDb(day(-4, 14)),
    receivingBy: "J. Mercado",
    docRef: "DR-2026-5859",
    remarks: "Rejected — cold chain broken in transit, product temperature above acceptable range.",
  },
  {
    id: "RR-2026-0085",
    arrivalId: "SC-DLV-2026-0298",
    supplierId: "SUP-2026-10032",
    supplierName: "Pacific Dry Goods Trading",
    items: [
      { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good", totalReceived: 100 },
      { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "damaged", totalReceived: 100 },
    ],
    totalQty: 100,
    receivedAt: isoToDb(day(0, 11)),
    receivingBy: "R. Dela Cruz",
    docRef: "DR-2026-5887",
    remarks: "50 units found damaged during receiving inspection.",
  },
];

/* Replacement requests seeded for demo. The replacement quantity is DERIVED
   (Expected − Accepted good on original receipts) — the demo numbers below
   mirror the seeded receipts so the math is consistent on a fresh database. */
const SEED_REPLACEMENTS = [
  {
    id: "RPL-2026-0112",
    arrivalId: "SC-DLV-2026-0272",
    productName: "Frozen Shrimp Vannamei (HLSO)",
    unit: "kg",
    expectedQty: 150,
    acceptedQty: 0,
    damagedQty: 150,
    replacementQty: 150,
    reason: "Cold chain broke in transit; full shipment rejected.",
    remarks: "Supplier coordinating replacement delivery.",
    status: "requested",
    requestedBy: "R. Dela Cruz",
    requestedAt: isoToDb(day(-4, 10)),
  },
];

/* Vendor Receiving acknowledgments seeded for demo. Each row records ACCEPTED
   stock the Vendor has confirmed receiving; the arrival status is derived from
   accepted vs received (see syncArrivalStatus). */
const SEED_VENDOR_RECEIVINGS = [
  {
    id: "VRC-2026-0001",
    arrivalId: "SC-DLV-2026-0311",
    receivedBy: "M. Santos",
    receivedAt: isoToDb(day(-1, 15)),
    remarks: "All accepted stock received and forwarded to inventory.",
    items: [
      { productName: "Korean BB Cream SPF 50+", unit: "pcs", qty: 200 },
      { productName: "Hyaluronic Acid Serum 30ml", unit: "pcs", qty: 120 },
    ],
  },
  {
    id: "VRC-2026-0002",
    arrivalId: "SC-DLV-2026-0298",
    receivedBy: "M. Santos",
    receivedAt: isoToDb(day(-2, 15)),
    remarks: "Partial acknowledgement; remaining accepted stock still on the dock.",
    items: [{ productName: "Canned Sardines 155g", unit: "pcs", qty: 1000 }],
  },
  {
    id: "VRC-2026-0003",
    arrivalId: "SC-DLV-2026-0287",
    receivedBy: "L. Villanueva",
    receivedAt: isoToDb(day(-1, 12)),
    remarks: "Accepted stock received in full.",
    items: [{ productName: "Matte Lipstick Trio", unit: "pcs", qty: 120 }],
  },
];

const SEED_NOTIFS = [
  { id: "N-001", title: "Supply Available for Receiving", message: "SC-DLV-2026-0334 (Pacific Dry Goods) arrived and is ready for receiving at Warehouse A.", type: "info", read: false, created: isoToDb(day(0, 9)) },
  { id: "N-002", title: "Expected Supply Incoming", message: "SC-DLV-2026-0338 (Pacific Fresh Distributors) expected delivery tomorrow at Cold Storage.", type: "info", read: true, created: isoToDb(day(-1, 16)) },
  { id: "N-003", title: "Vendor Received Partial", message: "Vendor acknowledged 1,000 of 1,550 accepted pcs for SC-DLV-2026-0298. 550 pcs remain on the receiving dock.", type: "warning", read: false, created: isoToDb(day(-2, 16)) },
  { id: "N-004", title: "Replacement Requested", message: "Frozen shrimp delivery damaged in transit — 150 kg rejected, replacement requested (SC-DLV-2026-0272).", type: "warning", read: true, created: isoToDb(day(-4, 15)) },
  { id: "N-005", title: "Vendor Receiving Completed", message: "SC-DLV-2026-0311 fully received — 320 accepted pcs forwarded to inventory (VRC-2026-0001).", type: "success", read: true, created: isoToDb(day(-1, 15)) },
  { id: "N-006", title: "Damaged Items Recorded", message: "100 pcs canned sardines inspected — 50 good, 50 damaged during inspection (RR-2026-0085).", type: "warning", read: false, created: isoToDb(day(0, 11)) },
];

/* Supply requests seeded for demo/tracking. Fulfillment numbers are NOT stored —
   they are derived from real receiving records via the arrival link below. */
const SEED_SUPPLY_REQUESTS = [
  {
    id: "VR-2026-0001",
    items: [{ productName: "Premium Jasmine Rice 25kg", qty: 100, unit: "sack" }],
    neededBy: dateOnly(day(4)),
    priority: "normal",
    reason: "Advance stock-up of staple rice ahead of scheduled operations.",
    remarks: "",
    status: "draft",
    requestedOn: isoToDb(day(-1, 9)),
    submittedOn: null,
    scReference: "",
    supplier: null,
    expectedDelivery: null,
    arrival: null,
  },
  {
    id: "VR-2026-0002",
    items: [{ productName: "Canned Sardines 155g", qty: 500, unit: "pcs" }],
    neededBy: dateOnly(day(2)),
    priority: "high",
    reason: "Sustained institutional demand; maintain buffer stock of canned goods.",
    remarks: "Preferred single-brand; source as coordinated by Supply Chain.",
    status: "under_review",
    requestedOn: isoToDb(day(-1, 11)),
    submittedOn: isoToDb(day(-1, 12)),
    scReference: "SC-REQ-2026-0299",
    supplier: null,
    expectedDelivery: null,
    arrival: null,
  },
  {
    id: "VR-2026-0003",
    items: [{ productName: "Canned Sardines 155g", qty: 2000, unit: "pcs" }],
    neededBy: dateOnly(day(1)),
    priority: "normal",
    reason: "Periodic bulk procurement of canned goods for retail operations.",
    remarks: "",
    status: "fulfillment_in_progress",
    requestedOn: isoToDb(day(-5, 9)),
    submittedOn: isoToDb(day(-4, 9)),
    scReference: "SC-REQ-2026-0298",
    supplier: { id: "SUP-2026-10032", name: "Pacific Dry Goods Trading" },
    expectedDelivery: dateOnly(day(1)),
    arrival: "SC-DLV-2026-0298",
  },
  {
    id: "VR-2026-0004",
    items: [{ productName: "Matte Lipstick Trio", qty: 120, unit: "pcs" }],
    neededBy: dateOnly(day(-1)),
    priority: "low",
    reason: "Replenish cosmetic counter inventory for the upcoming launch promotion.",
    remarks: "",
    status: "fulfilled",
    requestedOn: isoToDb(day(-6, 9)),
    submittedOn: isoToDb(day(-5, 9)),
    scReference: "SC-REQ-2026-0287",
    supplier: { id: "SUP-2026-10001", name: "BeautyPH Cosmetics Inc." },
    expectedDelivery: dateOnly(day(-2)),
    arrival: "SC-DLV-2026-0287",
  },
];

export async function seedSupplyRequestsIfEmpty() {
  const [[requestRow]] = await pool.query("SELECT COUNT(*) AS c FROM supply_requests");
  if (Number(requestRow.c) > 0) return;

  const [users] = await pool.query("SELECT id FROM users ORDER BY id LIMIT 1");
  if (users.length === 0) return;
  const requestedBy = users[0].id;

  for (const r of SEED_SUPPLY_REQUESTS) {
    const [req] = await pool.query("SELECT id FROM supply_requests WHERE id = ?", [r.id]);
    if (req.length > 0) continue;
    await pool.query(
      `INSERT INTO supply_requests
        (id, requested_by, request_date, needed_by_date, priority, reason, remarks, status,
         submitted_at, sc_reference, supplier_id, supplier_name, expected_delivery_date, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, requestedBy, r.requestedOn, r.neededBy, r.priority, r.reason, r.remarks,
        r.status, r.submittedOn, r.scReference, r.supplier?.id ?? null, r.supplier?.name ?? "", r.expectedDelivery, DEFAULT_VENDOR_ID]
    );
    for (const it of r.items) {
      const [products] = await pool.query("SELECT id FROM supplier_products WHERE name = ? ORDER BY id LIMIT 1", [it.productName]);
      const productId = products.length > 0 ? products[0].id : null;
      if (productId === null) {
        console.warn(`[seed] Product "${it.productName}" not found — skipping request item for ${r.id}.`);
        continue;
      }
      await pool.query(
        `INSERT INTO supply_request_items (request_id, product_id, product_name, quantity, unit)
         VALUES (?, ?, ?, ?, ?)`,
        [r.id, productId, it.productName, it.qty, it.unit]
      );
    }
    if (r.arrival) {
      await pool.query("UPDATE arrivals SET supply_request_id = ? WHERE id = ?", [r.id, r.arrival]);
    }
  }

  console.log("[seed] Supply requests reference data inserted.");
}

export async function seedIfEmpty() {
  const [[userRow]] = await pool.query("SELECT COUNT(*) AS c FROM users");
  if (Number(userRow.c) === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    await pool.query(
      "INSERT INTO users (username, password_hash, display_name, role, vendor_id) VALUES (?, ?, ?, ?, ?)",
      ["admin", hash, "Administrator", "admin", DEFAULT_VENDOR_ID]
    );
  }

  const [[supplierRow]] = await pool.query("SELECT COUNT(*) AS c FROM suppliers");
  if (Number(supplierRow.c) > 0) return;

  for (const s of SEED_SUPPLIERS) {
    await pool.query(
      `INSERT INTO suppliers
        (id, source_ref, vendor_id, company_name, contact_name, contact_email, contact_phone,
         supplier_type, address, email, phone, website, distribution_area, status, established_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.sourceRef, DEFAULT_VENDOR_ID, s.companyName, s.contactName, s.contactEmail, s.contactPhone,
        s.supplierType, s.address, s.email, s.phone, s.website, s.distributionArea, s.status, s.establishedOn]
    );
  }

  for (const p of SEED_PRODUCTS) {
    await pool.query(
      "INSERT INTO supplier_products (supplier_id, name, description, brand, category) VALUES (?, ?, ?, ?, ?)",
      [p.supplierId, p.name, p.description, p.brand, p.category]
    );
  }

  for (const a of SEED_ARRIVALS) {
    await pool.query(
      `INSERT INTO arrivals
        (id, source_ref, supplier_id, supplier_name, total_qty, expected_date, expected_time,
         destination, remarks, vendor_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.sourceRef, a.supplierId, a.supplierName, a.totalQty, a.expectedDate,
        a.expectedTime, a.destination, a.remarks, DEFAULT_VENDOR_ID, a.status, a.created]
    );
    for (const it of a.items) {
      await pool.query(
        "INSERT INTO arrival_items (arrival_id, product_name, qty, unit) VALUES (?, ?, ?, ?)",
        [a.id, it.productName, it.qty, it.unit]
      );
    }
  }

  for (const r of SEED_RECEIPTS) {
    await pool.query(
      `INSERT INTO receipts
        (id, arrival_id, supplier_id, supplier_name, status, total_qty, received_at, receiving_by, doc_ref, remarks, vendor_id, kind)
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, 'original')`,
      [r.id, r.arrivalId, r.supplierId, r.supplierName, r.totalQty, r.receivedAt, r.receivingBy, r.docRef, r.remarks, DEFAULT_VENDOR_ID]
    );
    for (const it of r.items) {
      await pool.query(
        "INSERT INTO receipt_items (receipt_id, product_name, qty, total_received_quantity, unit, condition_value, return_to_sc) VALUES (?, ?, ?, ?, ?, ?, 0)",
        [r.id, it.productName, it.qty, it.totalReceived ?? it.qty, it.unit, it.condition]
      );
    }
  }

  for (const rpl of SEED_REPLACEMENTS) {
    await pool.query(
      `INSERT INTO replacement_requests
        (id, arrival_id, product_name, unit, expected_qty, accepted_qty, damaged_qty,
         replacement_qty, reason, remarks, status, requested_by, requested_at, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rpl.id, rpl.arrivalId, rpl.productName, rpl.unit, rpl.expectedQty, rpl.acceptedQty,
        rpl.damagedQty, rpl.replacementQty, rpl.reason, rpl.remarks, rpl.status,
        rpl.requestedBy, rpl.requestedAt, DEFAULT_VENDOR_ID]
    );
  }

  for (const v of SEED_VENDOR_RECEIVINGS) {
    await pool.query(
      `INSERT INTO vendor_receivings (id, arrival_id, received_by, received_at, remarks, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [v.id, v.arrivalId, v.receivedBy, v.receivedAt, v.remarks, DEFAULT_VENDOR_ID]
    );
    for (const it of v.items) {
      await pool.query(
        "INSERT INTO vendor_receiving_items (receiving_id, arrival_id, product_name, unit, received_qty) VALUES (?, ?, ?, ?, ?)",
        [v.id, v.arrivalId, it.productName, it.unit, it.qty]
      );
    }
  }

  for (const n of SEED_NOTIFS) {
    await pool.query(
      "INSERT INTO notifications (id, title, message, type, is_read, vendor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [n.id, n.title, n.message, n.type, n.read ? 1 : 0, DEFAULT_VENDOR_ID, n.created]
    );
  }

  console.log("[seed] Reference data inserted.");
}

/* Builds a minimal but valid single-page PDF so demo delivery documents can
   be opened/downloaded in the receiving form. */
const makePdfDoc = (title) => {
  const safe = String(title).replace(/[()\\]/g, "\\$&");
  const content = `BT /F1 20 Tf 72 720 Td (${safe}) Tj ET\nBT /F1 12 Tf 72 692 Td (Supply Chain delivery document) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
};

/* Demonstrate the SC-delivery → receiving document relationship: attach a
   couple of PDFs to the demo deliveries so the receiving form can show them
   coming from MySQL. Idempotent — never duplicates per arrival. */
export async function seedDeliveryDocuments() {
  const [existing] = await pool.query(
    "SELECT arrival_id FROM delivery_documents WHERE arrival_id IS NOT NULL GROUP BY arrival_id"
  );
  const already = new Set(existing.map((r) => r.arrival_id));

  const specs = [
    { arrivalId: "SC-DLV-2026-0298", name: "Delivery Receipt.pdf" },
    { arrivalId: "SC-DLV-2026-0298", name: "Supporting Document.pdf" },
    { arrivalId: "SC-DLV-2026-0334", name: "Purchase/Delivery Document.pdf" },
    { arrivalId: "SC-DLV-2026-0311", name: "Delivery Receipt.pdf" },
  ];

  const root = join(process.cwd(), "uploads", "deliveries", DEFAULT_VENDOR_ID);
  await mkdir(root, { recursive: true }).catch(() => {});
  let inserted = 0;
  for (const s of specs) {
    if (already.has(s.arrivalId)) continue;
    const storedName = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const buffer = makePdfDoc(`${s.name} · ${s.arrivalId}`);
    await writeFile(join(root, storedName), buffer);
    await pool.query(
      `INSERT INTO delivery_documents (arrival_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, 'application/pdf', ?, NULL)`,
      [s.arrivalId, s.name, storedName, buffer.length]
    );
    inserted += 1;
  }
  if (inserted > 0) console.log(`[seed] Attached ${inserted} document(s) to demo SC deliveries.`);
}