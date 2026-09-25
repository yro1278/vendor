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
  { supplierId: "SUP-2026-10001", name: "Closeup Green Ulp R11", description: "Oral care toothpaste, green flavor.", brand: "Closeup", category: "Oral Care", sku: "COSM-0006", stock: 143, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Closeup Red Hot Ulp R11", description: "Oral care toothpaste, red hot flavor.", brand: "Closeup", category: "Oral Care", sku: "COSM-0007", stock: 110, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Cream Silk Hc Ultreborn Damage (Dark Blue)", description: "Hair care conditioner for damaged hair, dark blue variant.", brand: "Cream Silk", category: "Hair Care & Skin Care", sku: "COSM-0008", stock: 100, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Cream Silk Hc Ultreborn Strt (Pink)", description: "Hair care conditioner for starter hair, pink variant.", brand: "Cream Silk", category: "Hair Care & Skin Care", sku: "COSM-0009", stock: 29, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Cream Silk Tkr Straight 2", description: "Hair care straightening treatment.", brand: "Cream Silk", category: "Hair Care & Skin Care", sku: "COSM-0010", stock: 30, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Eskinol Fw Aloe", description: "Skincare aloe vera gel.", brand: "Eskinol", category: "Hair Care & Skin Care", sku: "COSM-0004", stock: 120, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Green Papaya Lotion", description: "Skin whitening lotion with green papaya extract.", brand: "Green Papaya", category: "Hair Care & Skin Care", sku: "COSM-0018", stock: 138, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Moisturizing Avocado Oil Soap", description: "Moisturizing soap with avocado oil.", brand: "Cosm", category: "Hair Care & Skin Care", sku: "COSM-0002", stock: 68, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Papaya Soap", description: "Exfoliating papaya soap.", brand: "Cosm", category: "Hair Care & Skin Care", sku: "COSM-0093", stock: 33, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Surf Bar Blossom Fresh", description: "Laundry bar with blossom fresh scent.", brand: "Surf", category: "Household & Laundry", sku: "COSM-0060", stock: 23, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Surf Bar Cherry Blossom", description: "Laundry bar with cherry blossom scent.", brand: "Surf", category: "Household & Laundry", sku: "COSM-0065", stock: 61, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Surf Bar Purple Blooms", description: "Laundry bar with purple blooms scent.", brand: "Surf", category: "Household & Laundry", sku: "COSM-0066", stock: 133, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Surf Bar Tawas", description: "Laundry bar with tawas formula.", brand: "Surf", category: "Household & Laundry", sku: "COSM-0063", stock: 39, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Surf Hs Std Pwdr Blossomfresh", description: "Laundry powder with blossomfresh scent.", brand: "Surf", category: "Household & Laundry", sku: "COSM-0052", stock: 148, unit: "pcs" },
  { supplierId: "SUP-2026-10001", name: "Surf Powder Kalamansi S", description: "Laundry powder with kalamansi scent.", brand: "Surf", category: "Household & Laundry", sku: "COSM-0057", stock: 138, unit: "pcs" },
];

const SEED_ARRIVALS = [];
const SEED_RECEIPTS = [];
const SEED_REPLACEMENTS = [];
const SEED_VENDOR_RECEIVINGS = [];
const SEED_NOTIFS = [];

const SEED_SUPPLY_REQUESTS = [];

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
   if (Number(supplierRow.c) > 0) {
     /* Update existing products with sku/stock/unit and add new products */
     for (const p of SEED_PRODUCTS) {
       const [existing] = await pool.query("SELECT id FROM supplier_products WHERE name = ? LIMIT 1", [p.name]);
       if (existing.length > 0) {
         await pool.query("UPDATE supplier_products SET sku = ?, stock = ?, unit = ? WHERE id = ?", [p.sku, p.stock, p.unit, existing[0].id]);
       } else {
         await pool.query("INSERT INTO supplier_products (supplier_id, name, description, brand, category, sku, stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [p.supplierId, p.name, p.description, p.brand, p.category, p.sku, p.stock, p.unit]);
       }
     }
     return;
   }

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
       "INSERT INTO supplier_products (supplier_id, name, description, brand, category, sku, stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
       [p.supplierId, p.name, p.description, p.brand, p.category, p.sku, p.stock, p.unit]
    );
  }

  /* Demo data seeding removed — mock arrivals, receipts, vendor receivings,
     notifications, and replacements are no longer seeded. The product/supplier
     master data is the only seed data. */

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

export async function seedDeliveryDocuments() {
  /* Demo delivery documents removed — no longer seeds mock delivery documents
     tied to demo SC deliveries. */
   console.log("[seed] Delivery documents skipped (demo data removed).");
}