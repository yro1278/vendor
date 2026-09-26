import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "./pool.js";
import { DEFAULT_VENDOR_ID } from "./constants.js";

/* ─────────────────────────────────────────────────────────
   OPERATING DATA LOADER

   Loads a coherent operating dataset built ENTIRELY from rows
   that already exist in MySQL: the real suppliers, the real
   supplier_products master and the real users. Nothing here is
   invented — every arrival item, receipt item and request item
   resolves to a product that is really in supplier_products, and
   every reference is looked up at run time instead of hardcoded.

   The dataset is shaped so each Vendor Management function has
   something real to show:

     expected            Supply Monitoring, not yet at the dock
     pending             accepted stock waiting for the Vendor
                         acknowledgment (Receiving work queue)
     partially_received  a delivery the Vendor already partly took,
                         and a delivery where damaged units are
                         still owed as a replacement
     completed           Receiving History — checker receipts plus
                         the Vendor's own acknowledgments

   Supply requests cover the whole status workflow, and three of
   them are linked to a real delivery so their fulfillment bars
   are computed from real receiving rows (mapRequestFulfillment)
   rather than stored numbers.

   Idempotent: an arrival (and everything hanging off it) is only
   written when its id is not already present, so re-running never
   duplicates rows. Pass { reset: true } to clear the transactional
   tables for this vendor first.
   ───────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

const dateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const day = (offset, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const dtStr = (d) => `${dateOnly(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

const DELIVERY_DOC_ROOT = join(process.cwd(), "uploads", "deliveries");

/* ── delivery documents ───────────────────────────────────
   The Supply Chain delivery travels with paperwork (waybill, DR).
   These are written as real, openable one-page PDFs so the
   receiving form's document viewer has genuine files to open
   instead of dead rows. */

/* A PDF string literal in WinAnsi encoding only carries single-byte characters.
   Typographic characters (em dash, curly quotes) and anything else outside
   WinAnsi would be silently dropped by the latin1 write, so they are folded to
   ASCII here rather than corrupting the document. */
const toWinAnsiAscii = (s) =>
  String(s)
    .replace(/[\u2010-\u2015]/g, "-")   /* hyphens, dashes */
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, "...")          /* ellipsis */
    .replace(/\u00A0/g, " ")            /* non-breaking space */
    .replace(/[^\x20-\x7E]/g, "?");     /* anything else is not representable */

const escapePdfText = (s) => toWinAnsiAscii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/* Minimal single-page PDF with a Helvetica text block. Offsets are
   byte offsets into the finished file, so the text is written as
   latin1 and measured in latin1 bytes. */
const buildDeliveryPdf = ({ deliveryRef, scheduleRef, supplierName, expectedDate, expectedTime, destination, lines }) => {
  const rows = [
    { text: "TRI-M GLOBAL LOGISTICS & TRADING INC.", size: 15, gap: 26 },
    { text: "Supply Chain Delivery Document", size: 11, gap: 20 },
    { text: `Delivery Ref:    ${deliveryRef}`, size: 10, gap: 15 },
    { text: `Schedule Ref:   ${scheduleRef}`, size: 10, gap: 15 },
    { text: `Supplier:       ${supplierName}`, size: 10, gap: 15 },
    { text: `Expected:       ${expectedDate} ${expectedTime}`, size: 10, gap: 15 },
    { text: `Destination:    ${destination}`, size: 10, gap: 22 },
    { text: "PRODUCT / QTY / UNIT", size: 10, gap: 16 },
    ...lines.map((l) => ({ text: `  ${l.name} - ${l.qty} ${l.unit}`, size: 10, gap: 14 })),
  ];

  let y = 730;
  let content = "";
  for (const row of rows) {
    content += `BT /F1 ${row.size} Tf 60 ${y} Td (${escapePdfText(row.text)}) Tj ET\n`;
    y -= row.gap;
  }

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`,
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

/* ── the plan ──────────────────────────────────────────────
   Quantities and statuses are the shape of the workflow. Every
   product name below must already exist in supplier_products —
   the loader refuses to run otherwise, so the dataset can never
   drift away from the real product master.

   `receipt` is the Checker/Inspection result (good + damaged).
   `acknowledged` is what the Vendor took. availableQty is
   derived by the backend as accepted − acknowledged, so the two
   must never exceed each other. */

const DELIVERIES = [
  {
    id: "SC-DLV-2026-0487",
    sourceRef: "SC-SCHED-2026-0219",
    offsetDays: 4,
    expectedTime: "10:00 AM",
    status: "expected",
    destination: "Tri-M Main Warehouse — Bay 3, Bocaue, Bulacan",
    remarks: "Monthly replenishment for the Oral Care and Household shelves.",
    items: [
      { product: "Surf Powder Kalamansi S", qty: 240 },
      { product: "Surf Hs Std Pwdr Blossomfresh", qty: 180 },
    ],
  },
  {
    id: "SC-DLV-2026-0471",
    sourceRef: "SC-SCHED-2026-0224",
    offsetDays: 9,
    expectedTime: "2:00 PM",
    status: "expected",
    destination: "Tri-M Main Warehouse — Bay 1, Bocaue, Bulacan",
    remarks: "Back-to-school promo build-up for Closeup.",
    items: [
      { product: "Closeup Green Ulp R11", qty: 150 },
      { product: "Closeup Red Hot Ulp R11", qty: 150 },
    ],
  },
  {
    id: "SC-DLV-2026-0455",
    sourceRef: "SC-SCHED-2026-0203",
    offsetDays: 0,
    expectedTime: "8:00 AM",
    status: "pending",
    destination: "Tri-M Main Warehouse — Bay 2, Bocaue, Bulacan",
    remarks: "Inspected and cleared by the dock checker. Awaiting Vendor acknowledgment.",
    items: [
      { product: "Eskinol Fw Aloe", qty: 96 },
      { product: "Green Papaya Lotion", qty: 72 },
    ],
    receipt: {
      id: "RR-2026-00031",
      offsetDays: 0,
      hour: 11,
      by: "Receiving Staff",
      docRef: "DR-2026-0771",
      remarks: "All units inspected good, seal intact on every carton.",
      lines: [
        { product: "Eskinol Fw Aloe", qty: 96, condition: "good" },
        { product: "Green Papaya Lotion", qty: 72, condition: "good" },
      ],
    },
  },
  {
    id: "SC-DLV-2026-0442",
    sourceRef: "SC-SCHED-2026-0191",
    offsetDays: -2,
    expectedTime: "9:00 AM",
    status: "partially_received",
    destination: "Tri-M Main Warehouse — Bay 4, Bocaue, Bulacan",
    remarks: "Short-delivered on the dark blue variant; the Vendor has partly acknowledged.",
    items: [
      { product: "Cream Silk Hc Ultreborn Damage (Dark Blue)", qty: 120 },
      { product: "Cream Silk Hc Ultreborn Strt (Pink)", qty: 40 },
    ],
    receipt: {
      id: "RR-2026-00028",
      offsetDays: -2,
      hour: 13,
      by: "Receiving Staff",
      docRef: "DR-2026-0758",
      remarks: "Only 100 of 120 dark blue units loaded. Balance confirmed short by the supplier.",
      lines: [
        { product: "Cream Silk Hc Ultreborn Damage (Dark Blue)", qty: 100, condition: "good" },
        { product: "Cream Silk Hc Ultreborn Strt (Pink)", qty: 40, condition: "good" },
      ],
    },
    acknowledged: {
      id: "VRC-2026-00412",
      offsetDays: -1,
      hour: 10,
      by: "Administrator",
      remarks: "Took the dark blue units and part of the pink; 10 pink pcs still to be pulled.",
      lines: [
        { product: "Cream Silk Hc Ultreborn Damage (Dark Blue)", qty: 100 },
        { product: "Cream Silk Hc Ultreborn Strt (Pink)", qty: 10 },
      ],
    },
  },
  {
    id: "SC-DLV-2026-0418",
    sourceRef: "SC-SCHED-2026-0176",
    offsetDays: -9,
    expectedTime: "10:30 AM",
    status: "partially_received",
    destination: "Tri-M Main Warehouse — Bay 3, Bocaue, Bulacan",
    remarks: "Twelve purple blooms units arrived crushed and were set aside for return.",
    items: [
      { product: "Surf Bar Blossom Fresh", qty: 72 },
      { product: "Surf Bar Cherry Blossom", qty: 72 },
      { product: "Surf Bar Purple Blooms", qty: 72 },
    ],
    receipt: {
      id: "RR-2026-00024",
      offsetDays: -9,
      hour: 15,
      by: "Receiving Staff",
      docRef: "DR-2026-0733",
      remarks: "Two cartons of Purple Blooms crushed in transit. 12 pcs rejected at inspection.",
      lines: [
        { product: "Surf Bar Blossom Fresh", qty: 72, condition: "good" },
        { product: "Surf Bar Cherry Blossom", qty: 72, condition: "good" },
        { product: "Surf Bar Purple Blooms", qty: 60, condition: "good" },
        { product: "Surf Bar Purple Blooms", qty: 12, condition: "damaged", returnToSc: true },
      ],
    },
    acknowledged: {
      id: "VRC-2026-00398",
      offsetDays: -8,
      hour: 9,
      by: "Administrator",
      remarks: "Accepted stock moved to the shelf. Damaged units returned to Supply Chain.",
      lines: [
        { product: "Surf Bar Blossom Fresh", qty: 72 },
        { product: "Surf Bar Cherry Blossom", qty: 72 },
        { product: "Surf Bar Purple Blooms", qty: 60 },
      ],
    },
  },
  {
    id: "SC-DLV-2026-0396",
    sourceRef: "SC-SCHED-2026-0158",
    offsetDays: -16,
    expectedTime: "1:00 PM",
    status: "completed",
    destination: "Tri-M Main Warehouse — Bay 1, Bocaue, Bulacan",
    remarks: "Clean delivery, fully inspected and fully acknowledged.",
    items: [
      { product: "Moisturizing Avocado Oil Soap", qty: 108 },
      { product: "Papaya Soap", qty: 54 },
    ],
    receipt: {
      id: "RR-2026-00019",
      offsetDays: -16,
      hour: 16,
      by: "Receiving Staff",
      docRef: "DR-2026-0702",
      remarks: "No discrepancies found.",
      lines: [
        { product: "Moisturizing Avocado Oil Soap", qty: 108, condition: "good" },
        { product: "Papaya Soap", qty: 54, condition: "good" },
      ],
    },
    acknowledged: {
      id: "VRC-2026-00371",
      offsetDays: -15,
      hour: 11,
      by: "Administrator",
      remarks: "Full quantity received and put away.",
      lines: [
        { product: "Moisturizing Avocado Oil Soap", qty: 108 },
        { product: "Papaya Soap", qty: 54 },
      ],
    },
  },
];

/* Supply requests across the full status workflow. `delivery` links a
   request to the arrival that fulfilled it, so the fulfillment bars
   come from real receipt rows. */
const REQUESTS = [
  {
    id: "VR-2026-0001",
    offsetDays: -1,
    neededByOffset: 12,
    priority: "normal",
    status: "draft",
    reason: "Regular replenishment for the Cream Silk shelf.",
    remarks: "Still confirming the promo calendar before submitting.",
    items: [{ product: "Cream Silk Tkr Straight 2", qty: 40 }],
  },
  {
    id: "VR-2026-0002",
    offsetDays: -3,
    neededByOffset: 7,
    priority: "high",
    status: "submitted",
    reason: "Tawa and papaya bars are running low ahead of the payday sales peak.",
    remarks: "Please include the shelf-ready cartons.",
    items: [
      { product: "Surf Bar Tawas", qty: 96 },
      { product: "Papaya Soap", qty: 60 },
    ],
  },
  {
    id: "VR-2026-0003",
    offsetDays: -5,
    neededByOffset: 14,
    priority: "normal",
    status: "under_review",
    reason: "Closeup Green is the volume mover and is down to single-digit days of cover.",
    remarks: "Open to a partial delivery if the full quantity is not ready.",
    items: [{ product: "Closeup Green Ulp R11", qty: 200 }],
  },
  {
    id: "VR-2026-0004",
    offsetDays: -7,
    neededByOffset: 6,
    priority: "urgent",
    status: "approved",
    reason: "Blossom Fresh and Cherry Blossom are needed for the branch transfer.",
    remarks: "Coordinate the pickup window with the warehouse.",
    scReference: "SC-PO-2026-1188",
    supplier: "SUP-2026-10001",
    expectedDeliveryOffset: 2,
    items: [
      { product: "Surf Bar Blossom Fresh", qty: 120 },
      { product: "Surf Bar Cherry Blossom", qty: 120 },
    ],
  },
  {
    id: "VR-2026-0005",
    delivery: "SC-DLV-2026-0455",
    offsetDays: -12,
    neededByOffset: 0,
    priority: "normal",
    status: "fulfillment_in_progress",
    reason: "Eskinol and Green Papaya replenishment for the skincare aisle.",
    remarks: "Stock is at the dock and is being pulled into the warehouse.",
    scReference: "SC-PO-2026-1164",
    supplier: "SUP-2026-10001",
    items: [
      { product: "Eskinol Fw Aloe", qty: 96 },
      { product: "Green Papaya Lotion", qty: 72 },
    ],
  },
  {
    id: "VR-2026-0006",
    delivery: "SC-DLV-2026-0442",
    offsetDays: -18,
    neededByOffset: -2,
    priority: "high",
    status: "partially_fulfilled",
    reason: "Cream Silk conditioner restock for the hair care shelf.",
    remarks: "Dark blue is still 20 pcs short of the requested quantity.",
    scReference: "SC-PO-2026-1142",
    supplier: "SUP-2026-10001",
    items: [
      { product: "Cream Silk Hc Ultreborn Damage (Dark Blue)", qty: 120 },
      { product: "Cream Silk Hc Ultreborn Strt (Pink)", qty: 40 },
    ],
  },
  {
    id: "VR-2026-0007",
    delivery: "SC-DLV-2026-0396",
    offsetDays: -25,
    neededByOffset: -16,
    priority: "normal",
    status: "fulfilled",
    reason: "Bar soap restock for the Bath & Body section.",
    remarks: "Delivered in full and acknowledged.",
    scReference: "SC-PO-2026-1108",
    supplier: "SUP-2026-10001",
    items: [
      { product: "Moisturizing Avocado Oil Soap", qty: 108 },
      { product: "Papaya Soap", qty: 54 },
    ],
  },
  {
    id: "VR-2026-0008",
    offsetDays: -4,
    neededByOffset: 3,
    priority: "urgent",
    status: "rejected",
    reason: "Urgent top-up of Kalamansi powder for the promo cart.",
    remarks: "Resubmitting with a different SKU mix once stock is confirmed.",
    items: [{ product: "Surf Powder Kalamansi S", qty: 300 }],
  },
];

/* ── helpers ─────────────────────────────────────────────── */

/* Existence checks run on the same connection as the writes so they see the
   transaction's own uncommitted rows instead of a stale snapshot. */
const arrivalExists = async (conn, id) => {
  const [rows] = await conn.query("SELECT id FROM arrivals WHERE id = ?", [id]);
  return rows.length > 0;
};

const requestExists = async (conn, id) => {
  const [rows] = await conn.query("SELECT id FROM supply_requests WHERE id = ?", [id]);
  return rows.length > 0;
};

const notificationExists = async (conn, id) => {
  const [rows] = await conn.query("SELECT id FROM notifications WHERE id = ?", [id]);
  return rows.length > 0;
};

async function insertDeliveryDocuments(conn, vendorId, delivery, productsByName) {
  const dir = join(DELIVERY_DOC_ROOT, vendorId);
  await mkdir(dir, { recursive: true });

  const pdf = buildDeliveryPdf({
    deliveryRef: delivery.id,
    scheduleRef: delivery.sourceRef,
    supplierName: delivery.supplierName,
    expectedDate: dateOnly(day(delivery.offsetDays)),
    expectedTime: delivery.expectedTime,
    destination: delivery.destination,
    lines: delivery.items.map((i) => ({ name: i.product, qty: i.qty, unit: productsByName.get(i.product).unit })),
  });

  const storedName = `${delivery.id.toLowerCase()}-delivery-note.pdf`;
  await writeFile(join(dir, storedName), pdf);

  await conn.query(
    `INSERT INTO delivery_documents (arrival_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
     VALUES (?, ?, ?, 'application/pdf', ?, NULL)`,
    [delivery.id, `${delivery.id} Delivery Note.pdf`, storedName, pdf.length]
  );
}

async function insertDelivery(conn, vendorId, delivery, supplier, productsByName) {
  const items = delivery.items.map((i) => ({ ...i, ...productsByName.get(i.product) }));
  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  await conn.query(
    `INSERT INTO arrivals
       (id, source_ref, supplier_id, supplier_name, total_qty, expected_date, expected_time,
        destination, remarks, vendor_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      delivery.id,
      delivery.sourceRef,
      supplier.id,
      supplier.company_name,
      totalQty,
      dateOnly(day(delivery.offsetDays)),
      delivery.expectedTime,
      delivery.destination,
      delivery.remarks,
      vendorId,
      delivery.status,
    ]
  );

  for (const it of items) {
    await conn.query(
      "INSERT INTO arrival_items (arrival_id, product_name, qty, unit) VALUES (?, ?, ?, ?)",
      [delivery.id, it.product, it.qty, it.unit]
    );
  }

  /* Checker / Inspection result. total_received_quantity repeats the total for
     that product+unit across every condition row in the same receipt, which is
     what the receiving history prints. */
  if (delivery.receipt) {
    const r = delivery.receipt;
    const resolved = r.lines.map((l) => ({ ...l, ...productsByName.get(l.product) }));
    const receiptTotal = resolved.reduce((a, l) => a + l.qty, 0);

    await conn.query(
      `INSERT INTO receipts
         (id, arrival_id, supplier_id, supplier_name, status, total_qty, received_at,
          receiving_by, doc_ref, remarks, kind, vendor_id)
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, 'original', ?)`,
      [
        r.id,
        delivery.id,
        supplier.id,
        supplier.company_name,
        receiptTotal,
        dtStr(day(r.offsetDays, r.hour)),
        r.by,
        r.docRef,
        r.remarks,
        vendorId,
      ]
    );

    const perProductTotal = new Map();
    for (const l of resolved) {
      const key = `${l.product}::${l.unit}`;
      perProductTotal.set(key, (perProductTotal.get(key) ?? 0) + l.qty);
    }

    for (const l of resolved) {
      await conn.query(
        `INSERT INTO receipt_items
           (receipt_id, product_name, qty, total_received_quantity, unit, condition_value, return_to_sc)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          l.product,
          l.qty,
          perProductTotal.get(`${l.product}::${l.unit}`),
          l.unit,
          l.condition,
          l.returnToSc ? 1 : 0,
        ]
      );
    }
  }

  /* Vendor acknowledgment of the accepted stock. */
  if (delivery.acknowledged) {
    const a = delivery.acknowledged;
    await conn.query(
      `INSERT INTO vendor_receivings (id, arrival_id, received_by, received_at, remarks, vendor_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [a.id, delivery.id, a.by, dtStr(day(a.offsetDays, a.hour)), a.remarks, vendorId]
    );
    for (const l of a.lines) {
      const p = productsByName.get(l.product);
      await conn.query(
        `INSERT INTO vendor_receiving_items (receiving_id, arrival_id, product_name, unit, received_qty)
         VALUES (?, ?, ?, ?, ?)`,
        [a.id, delivery.id, l.product, p.unit, l.qty]
      );
    }
  }

  await insertDeliveryDocuments(conn, vendorId, { ...delivery, supplierName: supplier.company_name }, productsByName);
}

async function insertRequest(conn, vendorId, request, requesterId, suppliersById, productsByName) {
  const supplier = request.supplier ? suppliersById.get(request.supplier) : null;
  const submittedStatuses = new Set([
    "submitted",
    "under_review",
    "approved",
    "processing",
    "fulfillment_in_progress",
    "partially_fulfilled",
    "fulfilled",
    "rejected",
  ]);

  await conn.query(
    `INSERT INTO supply_requests
       (id, requested_by, request_date, needed_by_date, priority, reason, remarks, status,
        submitted_at, sc_reference, processing_status, supplier_id, supplier_name,
        expected_delivery_date, vendor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.id,
      requesterId,
      dtStr(day(request.offsetDays, 10)),
      dateOnly(day(request.neededByOffset)),
      request.priority,
      request.reason,
      request.remarks,
      request.status,
      submittedStatuses.has(request.status) ? dtStr(day(request.offsetDays, 10, 30)) : null,
      request.scReference ?? "",
      request.status,
      supplier?.id ?? null,
      supplier?.company_name ?? "",
      request.expectedDeliveryOffset === undefined ? null : dateOnly(day(request.expectedDeliveryOffset)),
      vendorId,
    ]
  );

  for (const it of request.items) {
    const p = productsByName.get(it.product);
    await conn.query(
      `INSERT INTO supply_request_items (request_id, product_id, product_name, quantity, unit, remarks)
       VALUES (?, ?, ?, ?, ?, '')`,
      [request.id, p.id, it.product, it.qty, p.unit]
    );
  }

  /* Linking the request to the delivery that fulfilled it is what makes
     mapRequestFulfillment() find the real receipt rows. */
  if (request.delivery) {
    await conn.query("UPDATE arrivals SET supply_request_id = ? WHERE id = ?", [request.id, request.delivery]);
  }
}

/* Notifications describing the deliveries and requests above. The id is derived
   from the row's own timestamp and position so re-running the loader recognises
   them and never stacks duplicates. */
const NOTIFICATIONS = [
  {
    id: "ops-01",
    title: "Delivery expected soon",
    message: (d, s) => `${d[0].id} from ${s.company_name} is scheduled in 4 days.`,
    type: "info",
    read: 0,
    at: () => day(-1, 9, 15),
  },
  {
    id: "ops-02",
    title: "Stock ready to acknowledge",
    message: (d) => `${d[2].id} was inspected and all units were accepted. Acknowledge the accepted stock to close the delivery.`,
    type: "warning",
    read: 0,
    at: () => day(0, 11, 5),
  },
  {
    id: "ops-03",
    title: "Short delivery on Cream Silk",
    message: (d) => `${d[3].id} arrived 20 pcs short on the dark blue variant. The balance is still owed.`,
    type: "warning",
    read: 0,
    at: () => day(-2, 13, 40),
  },
  {
    id: "ops-04",
    title: "Damaged units set aside",
    message: (d) => `12 pcs of Surf Bar Purple Blooms from ${d[4].id} were rejected at inspection and marked for return to Supply Chain.`,
    type: "error",
    read: 0,
    at: () => day(-9, 15, 20),
  },
  {
    id: "ops-05",
    title: "Delivery completed",
    message: (d) => `${d[5].id} was fully acknowledged. The items are now in the warehouse.`,
    type: "success",
    read: 1,
    at: () => day(-15, 11, 30),
  },
  {
    id: "ops-06",
    title: "Supply request approved",
    message: () => "VR-2026-0004 was approved by Supply Chain under reference SC-PO-2026-1188.",
    type: "success",
    read: 1,
    at: () => day(-5, 14, 10),
  },
  {
    id: "ops-07",
    title: "Supply request needs review",
    message: () => "VR-2026-0003 is under review by Supply Chain. We will confirm the allocation shortly.",
    type: "info",
    read: 1,
    at: () => day(-3, 10, 45),
  },
];

/* ── entry point ─────────────────────────────────────────── */

export async function seedOperationsData({ reset = false } = {}) {
  const vendorId = DEFAULT_VENDOR_ID;

  const [suppliers] = await pool.query(
    "SELECT * FROM suppliers WHERE vendor_id = ? ORDER BY company_name",
    [vendorId]
  );
  const [products] = await pool.query(
    `SELECT sp.* FROM supplier_products sp
     JOIN suppliers s ON s.id = sp.supplier_id
     WHERE s.vendor_id = ?
     ORDER BY sp.name`,
    [vendorId]
  );
  const [users] = await pool.query(
    "SELECT id FROM users WHERE vendor_id = ? ORDER BY role = 'admin' DESC, id LIMIT 1",
    [vendorId]
  );

  if (suppliers.length === 0) throw new Error("No suppliers found for this vendor. Run the base seed first.");
  if (users.length === 0) throw new Error("No users found for this vendor. Run the base seed first.");

  const requesterId = users[0].id;
  const productsByName = new Map(products.map((p) => [p.name, p]));
  const suppliersById = new Map(suppliers.map((s) => [s.id, s]));

  /* Every product the plan names must really exist. Refusing to run is safer
     than writing a delivery that points at a product nobody stocks. */
  const missing = new Set();
  for (const d of DELIVERIES) {
    for (const i of d.items) if (!productsByName.has(i.product)) missing.add(i.product);
    for (const l of d.receipt?.lines ?? []) if (!productsByName.has(l.product)) missing.add(l.product);
    for (const l of d.acknowledged?.lines ?? []) if (!productsByName.has(l.product)) missing.add(l.product);
  }
  for (const r of REQUESTS) {
    for (const i of r.items) if (!productsByName.has(i.product)) missing.add(i.product);
  }
  if (missing.size > 0) {
    throw new Error(
      `These products are not in supplier_products, so the operating data cannot be built: ${[...missing].join(", ")}`
    );
  }

  /* Deliveries belong to the supplier that actually stocks the products. */
  const productSupplierIds = new Set(products.map((p) => p.supplier_id));
  const deliverySupplier =
    suppliers.find((s) => productSupplierIds.has(s.id)) ?? suppliers[0];
  const supportingSuppliers = suppliers.filter((s) => s.id !== deliverySupplier.id);

  if (reset) {
    /* Ordered child → parent so the foreign keys stay satisfied throughout.
       supply_request_items has no vendor_id of its own, so it goes through
       its parent request. */
    await pool.query(
      "DELETE FROM supply_request_items WHERE request_id IN (SELECT id FROM supply_requests WHERE vendor_id = ?)",
      [vendorId]
    );
    await pool.query("DELETE FROM supply_requests WHERE vendor_id = ?", [vendorId]);
    await pool.query("DELETE FROM notifications WHERE vendor_id = ?", [vendorId]);
    await pool.query(
      "DELETE FROM vendor_receiving_items WHERE arrival_id IN (SELECT id FROM arrivals WHERE vendor_id = ?)",
      [vendorId]
    );
    await pool.query("DELETE FROM vendor_receivings WHERE vendor_id = ?", [vendorId]);
    await pool.query(
      "DELETE FROM receipt_corrections WHERE arrival_id IN (SELECT id FROM arrivals WHERE vendor_id = ?)",
      [vendorId]
    );
    await pool.query(
      "DELETE FROM receipt_items WHERE receipt_id IN (SELECT id FROM receipts WHERE vendor_id = ?)",
      [vendorId]
    );
    await pool.query("DELETE FROM receipts WHERE vendor_id = ?", [vendorId]);
    await pool.query(
      "DELETE FROM delivery_documents WHERE arrival_id IN (SELECT id FROM arrivals WHERE vendor_id = ?)",
      [vendorId]
    );
    await pool.query(
      "DELETE FROM arrival_items WHERE arrival_id IN (SELECT id FROM arrivals WHERE vendor_id = ?)",
      [vendorId]
    );
    await pool.query("DELETE FROM arrivals WHERE vendor_id = ?", [vendorId]);
    console.log("[ops] Existing operating data cleared.");
  }

  const conn = await pool.getConnection();
  let deliveriesAdded = 0;
  let requestsAdded = 0;
  let notificationsAdded = 0;
  try {
    await conn.beginTransaction();

    for (const d of DELIVERIES) {
      if (await arrivalExists(conn, d.id)) continue;
      await insertDelivery(conn, vendorId, d, deliverySupplier, productsByName);
      deliveriesAdded += 1;
    }

    for (const r of REQUESTS) {
      if (await requestExists(conn, r.id)) continue;
      await insertRequest(conn, vendorId, r, requesterId, suppliersById, productsByName);
      requestsAdded += 1;
    }

    for (const n of NOTIFICATIONS) {
      if (await notificationExists(conn, n.id)) continue;
      const at = n.at();
      await conn.query(
        `INSERT INTO notifications (id, title, message, type, is_read, vendor_id, recipient, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'all', ?)`,
        [n.id, n.title, n.message(DELIVERIES, deliverySupplier), n.type, n.read, vendorId, dtStr(at)]
      );
      notificationsAdded += 1;
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  /* Notifications are written outside the transaction above so a notification
     is never rolled back with the data it describes. */
  const [[counts]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM arrivals WHERE vendor_id = ?) AS arrivals,
       (SELECT COUNT(*) FROM arrival_items) AS arrival_items,
       (SELECT COUNT(*) FROM receipts WHERE vendor_id = ?) AS receipts,
       (SELECT COUNT(*) FROM receipt_items) AS receipt_items,
       (SELECT COUNT(*) FROM vendor_receivings WHERE vendor_id = ?) AS vendor_receivings,
       (SELECT COUNT(*) FROM delivery_documents) AS delivery_documents,
       (SELECT COUNT(*) FROM supply_requests WHERE vendor_id = ?) AS supply_requests,
       (SELECT COUNT(*) FROM supply_request_items) AS supply_request_items,
       (SELECT COUNT(*) FROM notifications WHERE vendor_id = ?) AS notifications`,
    [vendorId, vendorId, vendorId, vendorId, vendorId]
  );

  console.log(`[ops] Added ${deliveriesAdded} deliver(y/ies), ${requestsAdded} supply request(s), ${notificationsAdded} notification(s).`);
  console.log(`[ops] Deliveries use ${deliverySupplier.company_name} (${productsByName.size} real products).`);
  if (supportingSuppliers.length > 0) {
    console.log(
      `[ops] ${supportingSuppliers.map((s) => s.company_name).join(", ")} kept with no deliveries — they have no products in supplier_products yet.`
    );
  }
  console.log("[ops] Current totals:", counts);
  return counts;
}
