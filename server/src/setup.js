import { initDb } from "./db/index.js";
import { config } from "./config.js";

try {
  await initDb();
  console.log(`[setup] Database '${config.db.database}' is ready.`);
  process.exit(0);
} catch (err) {
  console.error("[setup] Database initialization failed:", err);
  process.exit(1);
}