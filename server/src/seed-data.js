import { pool } from "./db/pool.js";
import { initDb } from "./db/index.js";
import { seedOperationsData } from "./db/seed-operations.js";
import { config } from "./config.js";

/* Loads the operating dataset (deliveries, checker receipts, Vendor
   acknowledgments, supply requests, notifications and delivery documents)
   on top of the base reference data.

   Everything it writes is resolved from the products, suppliers and users
   that are really in MySQL — see db/seed-operations.js.

   Usage:
     npm run seed:data          add anything that is missing
     npm run seed:data -- --reset   clear the vendor's operating data first
*/

const reset = process.argv.includes("--reset");

try {
  await initDb();
  console.log(`[seed] Database '${config.db.database}' is ready.`);
  await seedOperationsData({ reset });
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("[seed] Operating data load failed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
}
