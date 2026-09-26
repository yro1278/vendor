const parsePort = (value, fallback) => {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: parsePort(process.env.PORT, 4000),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parsePort(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "tri_m_vendor",
    connectionLimit: parsePort(process.env.DB_POOL_CONNECTION_LIMIT, 10),
    charset: "utf8mb4",
    dateStrings: true,
    connectTimeout: 10000,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "trim-vendor-dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  },
  session: {
    /* Vendor Management session idle timeout — EXACTLY 5 minutes of
       inactivity. Enforced on the backend for every protected vendor API
       call via the sessions table (sliding window; the token is revoked
       the moment the timeout lapses). The UI mirrors this window in
       src/app/VendorModule.tsx (IDLE_TIMEOUT_MS). */
    timeoutMinutes: 5,
  },
  autoMigrate: String(process.env.AUTO_MIGRATE ?? "true") !== "false",
};