import { pool, ensureDatabase } from "./pool.js";
import { createSchemaStatements } from "./schema.js";
import { seedIfEmpty, seedSupplyRequestsIfEmpty } from "./seed.js";
import { DEFAULT_VENDOR } from "./constants.js";

const MIGRATIONS = [
  `ALTER TABLE receipts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'confirmed' AFTER supplier_name`,
  `ALTER TABLE receipts ADD INDEX idx_receipts_status (status)`,
  `ALTER TABLE receipts MODIFY COLUMN total_qty DECIMAL(12,3) NOT NULL DEFAULT 0`,
  `ALTER TABLE receipt_items MODIFY COLUMN qty DECIMAL(12,3) NOT NULL`,
  `ALTER TABLE receipt_items ADD COLUMN total_received_quantity DECIMAL(12,3) NULL AFTER qty`,
  `ALTER TABLE receipt_items ADD COLUMN condition_value VARCHAR(20) NOT NULL DEFAULT 'good'`,
  `ALTER TABLE receipt_items ADD INDEX idx_ri_receipt_product (receipt_id, product_name, unit)`,
  `ALTER TABLE receipts ADD CONSTRAINT chk_receipts_total CHECK (total_qty >= 0)`,
  `ALTER TABLE receipt_items ADD CONSTRAINT chk_ri_qty CHECK (qty > 0)`,
  `ALTER TABLE arrivals ADD COLUMN supply_request_id VARCHAR(40) NULL AFTER remarks`,
  `ALTER TABLE arrivals ADD INDEX idx_arrivals_supply_request (supply_request_id)`,
  `ALTER TABLE arrivals ADD CONSTRAINT fk_arrival_supply_request FOREIGN KEY (supply_request_id) REFERENCES supply_requests (id) ON DELETE SET NULL`,
  `ALTER TABLE users ADD COLUMN vendor_id VARCHAR(40) NULL AFTER role`,
  `ALTER TABLE users MODIFY COLUMN vendor_id VARCHAR(40) NULL`,
  `ALTER TABLE users ADD INDEX idx_users_vendor (vendor_id)`,
  `ALTER TABLE suppliers ADD COLUMN vendor_id VARCHAR(40) NOT NULL DEFAULT '' AFTER source_ref`,
  `ALTER TABLE suppliers ADD INDEX idx_suppliers_vendor (vendor_id)`,
  `ALTER TABLE arrivals ADD COLUMN vendor_id VARCHAR(40) NOT NULL DEFAULT '' AFTER remarks`,
  `ALTER TABLE arrivals ADD INDEX idx_arrivals_vendor (vendor_id)`,
  `ALTER TABLE receipts ADD COLUMN vendor_id VARCHAR(40) NOT NULL DEFAULT '' AFTER remarks`,
  `ALTER TABLE receipts ADD INDEX idx_receipts_vendor (vendor_id)`,
  `ALTER TABLE notifications ADD COLUMN vendor_id VARCHAR(40) NOT NULL DEFAULT '' AFTER is_read`,
  `ALTER TABLE notifications ADD INDEX idx_notifications_vendor (vendor_id)`,
  `ALTER TABLE supply_requests ADD COLUMN vendor_id VARCHAR(40) NOT NULL DEFAULT '' AFTER expected_delivery_date`,
  `ALTER TABLE supply_requests ADD INDEX idx_req_vendor (vendor_id)`,
];

/*
 * Idempotency: MariaDB reports "duplicate constraint/index already exists"
 * from a retried ALTER as one of several errno values depending on clause:
 *   1060 duplicate column, 1061 duplicate key, 1826/3822 duplicate constraint,
 *   1215/1005 (MariaDB surfaces 1005 with "(errno: 121 ...)") when the same
 *   FOREIGN KEY constraint is added again. 1022/121 = duplicate key name.
 */
const IGNORE_MIGRATION_CODES = new Set([1060, 1061, 3822, 1826, 1215, 1005, 121, 1022]);

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (IGNORE_MIGRATION_CODES.has(err?.errno)) continue;
      throw err;
    }
  }
}

async function ensureDefaultVendor() {
  const [existing] = await pool.query("SELECT id FROM vendors WHERE id = ?", [DEFAULT_VENDOR.id]);
  if (existing.length === 0) {
    await pool.query(
      `INSERT INTO vendors (id, company_name, contact_name, contact_email, contact_phone, address, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [DEFAULT_VENDOR.id, DEFAULT_VENDOR.companyName, DEFAULT_VENDOR.contactName,
        DEFAULT_VENDOR.contactEmail, DEFAULT_VENDOR.contactPhone, DEFAULT_VENDOR.address]
    );
  }

  const updateCases = [
    ["UPDATE users SET vendor_id = (SELECT id FROM vendors WHERE is_active = 1 ORDER BY id LIMIT 1) WHERE vendor_id IS NULL"],
    ["UPDATE suppliers SET vendor_id = ? WHERE vendor_id = ''", [DEFAULT_VENDOR.id]],
    ["UPDATE arrivals SET vendor_id = ? WHERE vendor_id = ''", [DEFAULT_VENDOR.id]],
    ["UPDATE receipts SET vendor_id = ? WHERE vendor_id = ''", [DEFAULT_VENDOR.id]],
    ["UPDATE notifications SET vendor_id = ? WHERE vendor_id = ''", [DEFAULT_VENDOR.id]],
    ["UPDATE supply_requests SET vendor_id = ? WHERE vendor_id = ''", [DEFAULT_VENDOR.id]],
  ];
  for (const [sql, params = []] of updateCases) {
    await pool.query(sql, params);
  }
}

export async function initDb() {
  await ensureDatabase();
  const statements = createSchemaStatements();
  for (const sql of statements) {
    await pool.query(sql);
  }
  await runMigrations();
  await ensureDefaultVendor();
  await seedIfEmpty();
  await seedSupplyRequestsIfEmpty();
}

export { pool } from "./pool.js";