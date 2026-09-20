import mysql from "mysql2/promise";
const c = await mysql.createConnection({ host: "127.0.0.1", port: 3306, user: "root", database: "tri_m_vendor" });
const [idx] = await c.query(`SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='tri_m_vendor' AND TABLE_NAME='arrivals' ORDER BY INDEX_NAME, SEQ_IN_INDEX`);
const [fks] = await c.query(`SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='tri_m_vendor' AND TABLE_NAME='arrivals' AND REFERENCED_TABLE_NAME IS NOT NULL`);
console.log("INDEXES:");
for (const r of idx) console.log(" ", JSON.stringify(r));
console.log("FKS:");
for (const r of fks) console.log(" ", JSON.stringify(r));
await c.end();