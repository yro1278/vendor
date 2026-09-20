import { pool } from "./db/pool.js";

/* Appends a row to audit_logs. Pass `conn` when the caller is already inside a
   transaction so the audit write commits atomically with the business change. */
export async function logAudit({
  conn = null,
  user = null,
  action,
  entityType = "",
  entityId = "",
  detail = "",
  ip = "",
}) {
  const sql =
    "INSERT INTO audit_logs (user_id, vendor_id, action, entity_type, entity_id, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
  const params = [
    user?.sub ?? user?.id ?? null,
    user?.vendorId ?? null,
    String(action).slice(0, 60),
    String(entityType).slice(0, 60),
    String(entityId).slice(0, 100),
    String(detail ?? "").slice(0, 1000),
    String(ip ?? "").slice(0, 64),
  ];
  if (conn) await conn.query(sql, params);
  else await pool.query(sql, params);
}