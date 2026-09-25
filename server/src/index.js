import { app } from "./app.js";
import { config } from "./config.js";
import { initDb } from "./db/index.js";
import { mkdir } from "node:fs/promises";

async function main() {
  if (config.autoMigrate) {
    try {
      await initDb();
      console.log(`[db] Database '${config.db.database}' ready.`);
    } catch (err) {
      console.warn(`[db] Could not initialize database: ${err.message}`);
      console.warn("[db] Set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME in server/.env");
    }
  }
  /* Ensure document storage directories exist before multer writes to them. */
  for (const dir of ["uploads/company", "uploads/deliveries", "uploads/applications"]) {
    await mkdir(dir, { recursive: true }).catch((err) => console.warn(`[db] Could not create ${dir}: ${err.message}`));
  }
  app.listen(config.port, () => {
    console.log(`Tri-M Vendor API listening on http://localhost:${config.port}`);
  });
}

main();