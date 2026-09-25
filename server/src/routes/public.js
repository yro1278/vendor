import { Router } from "express";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import multer from "multer";
import { asyncHandler, httpError } from "../util.js";
import {
  createSupplierApplication,
  lookupApplicationStatus,
  resubmitSupplierApplication,
  validateSupplierApplicationPayload,
} from "../store.js";
import { DEFAULT_VENDOR_ID } from "../db/constants.js";
import { APPLICATION_DOC_MIME } from "../db/constants.js";

/* Public supplier-sourcing endpoints — no authentication. Visitors use these
   to submit an application and check its status; Tri-M staff review through
   the authenticated /api/vendor router. */

const MAX_DOC_BYTES = 10 * 1024 * 1024;
const UPLOAD_APP_ROOT = join(process.cwd(), "uploads", "applications");
const TMP_DIR = join(UPLOAD_APP_ROOT, "_tmp");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => fsMkdir(TMP_DIR).then(() => cb(null, TMP_DIR)).catch(cb),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${randomUUID()}${extname(file.originalname || "").toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_DOC_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname?.replace(/\0/g, "") ?? "";
    const ext = extname(name).toLowerCase().replace(/^\./, "");
    const allowedExt = APPLICATION_DOC_MIME[file.mimetype] ?? [];
    if (!allowedExt.includes(`.${ext}`)) {
      return cb(new Error("File type not allowed. Accepted types: PDF, JPG/JPEG, PNG."));
    }
    cb(null, true);
  },
});

/* Server-generated stored names only — safe for join() without sanitization. */
const safeJoin = (appId, storedName) => join(UPLOAD_APP_ROOT, String(appId), String(storedName));

const fsMkdir = (dir) => import("node:fs/promises").then((m) => m.mkdir(dir, { recursive: true }));
const fsMove = (from, to) => import("node:fs/promises").then((m) => m.rename(from, to));
const fsUnlink = (p) => import("node:fs/promises").then((m) => m.unlink(p));

const toStr = (v) => (typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : String(v ?? ""));

function parseFormBody(req) {
  const body = req.body ?? {};
  let products = [];
  try {
    const raw = JSON.parse(toStr(body.products));
    if (Array.isArray(raw)) products = raw;
  } catch {
    /* invalid JSON → empty products (caught by validation) */
  }
  return {
    companyName: toStr(body.companyName),
    businessRegNo: toStr(body.businessRegNo),
    tin: toStr(body.tin),
    address: toStr(body.address),
    email: toStr(body.email),
    phone: toStr(body.phone),
    website: toStr(body.website),
    distributionArea: toStr(body.distributionArea),
    contactName: toStr(body.contactName),
    contactPosition: toStr(body.contactPosition),
    supplierType: toStr(body.supplierType),
    yearsInBusiness: toStr(body.yearsInBusiness),
    products,
  };
}

const fileRows = (files) =>
  (files ?? []).map((f) => ({
    storedName: f.filename,
    originalName: f.originalname,
    mimeType: f.mimetype,
    sizeBytes: f.size,
  }));

const publicUser = (req) => ({ vendorId: DEFAULT_VENDOR_ID, sub: null, ip: req.ip ?? "" });

const router = Router();

/* Move accepted uploads into the application folder; clean up leftover temp
   files when the request fails so nothing is orphaned on disk. */
async function settleUploads(appId, rows) {
  if (!appId) return;
  const dir = join(UPLOAD_APP_ROOT, String(appId));
  await fsMkdir(dir);
  for (const r of rows) {
    await fsMove(join(TMP_DIR, r.storedName), safeJoin(appId, r.storedName)).catch(() => {});
  }
}

async function discardTempUploads(rows) {
  for (const r of rows) {
    await fsUnlink(join(TMP_DIR, r.storedName)).catch(() => {});
  }
}

router.post(
  "/applications",
  upload.array("files", 5),
  asyncHandler(async (req, res) => {
    const rows = fileRows(req.files);
    let parsed;
    try {
      parsed = validateSupplierApplicationPayload(parseFormBody(req));
    } catch (err) {
      await discardTempUploads(rows);
      throw err;
    }
    if (rows.length === 0) {
      await discardTempUploads(rows);
      throw httpError(400, "Upload at least one supporting document (PDF, JPG, or PNG).");
    }
    let app = null;
    let appId = null;
    try {
      app = await createSupplierApplication(parsed, rows, publicUser(req));
      appId = app?.id;
      await settleUploads(appId, rows);
    } catch (err) {
      await discardTempUploads(rows);
      throw err;
    }
    res.status(201).json({ id: app.id, submittedAt: app.submittedAt, status: app.status });
  })
);

router.post(
  "/applications/resubmit",
  upload.array("files", 5),
  asyncHandler(async (req, res) => {
    const rows = fileRows(req.files);
    let parsed;
    try {
      parsed = validateSupplierApplicationPayload(parseFormBody(req));
    } catch (err) {
      await discardTempUploads(rows);
      throw err;
    }
    const appId = toStr(req.body?.id).trim();
    const email = toStr(req.body?.email).trim();
    if (!appId || !email) {
      await discardTempUploads(rows);
      throw httpError(400, "Application ID and email are required to resubmit.");
    }
    if (rows.length === 0) {
      await discardTempUploads(rows);
      throw httpError(400, "Upload at least one supporting document (PDF, JPG, or PNG).");
    }
    let app = null;
    try {
      app = await resubmitSupplierApplication(appId, email, parsed, rows, publicUser(req));
      await settleUploads(appId, rows);
    } catch (err) {
      await discardTempUploads(rows);
      throw err;
    }
    res.json({ id: app.id, submittedAt: app.submittedAt, status: app.status });
  })
);

router.get(
  "/applications/status",
  asyncHandler(async (req, res) => {
    const id = toStr(req.query.id).trim();
    const email = toStr(req.query.email).trim();
    if (!id || !email) {
      throw httpError(400, "Application ID and email are required to check status.");
    }
    const app = await lookupApplicationStatus(id, email);
    if (!app) throw httpError(404, "Application not found. Check your Application ID and email.");
    res.json(app);
  })
);

export default router;