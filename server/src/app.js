import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import publicRouter from "./routes/public.js";
import vendorRouter from "./routes/vendor.js";
import { requireAuth, requireVendor } from "./auth.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* Unauthenticated supplier-sourcing endpoints (apply + status lookup). */
app.use("/api/public", publicRouter);

app.use("/api/auth", authRouter);
app.use("/api/vendor", requireAuth, requireVendor, vendorRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, _req, res, _next) => {
  const isDbUnavailable =
    err &&
    ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "PROTOCOL_CONNECTION_LOST"].includes(err.code);
  const isMulterError = err && (err.name === "MulterError" || /^File type not allowed/.test(err.message ?? ""));
  const status = isDbUnavailable
    ? 503
    : err.status || (err && err.code === "ER_DUP_ENTRY" ? 409 : isMulterError ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    ...(err?.extra?.errors ? { errors: err.extra.errors } : {}),
    error:
      status === 503
        ? "Database is unavailable."
        : status >= 500
          ? "Internal server error."
          : err.message,
  });
});