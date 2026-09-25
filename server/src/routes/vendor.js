import { Router } from "express";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import multer from "multer";
import { asyncHandler, httpError } from "../util.js";
import { requireRole } from "../auth.js";
import { config } from "../config.js";
import { generateReceivingReport, verifyReceivingReportPassword } from "../receiving-report.js";
import {
  approveApplication,
  cancelSupplyRequest,
  clearNotifications,
  confirmReceipt,
  createReceipt,
  createSupplyRequest,
  deleteCompanyDocument,
  fetchApplicationById,
  fetchApplicationDocument,
  fetchApplications,
  fetchAuditLogs,
  fetchBootstrap,
  fetchCompanyDocument,
  fetchCompanyProfile,
  fetchDashboard,
  fetchEvaluations,
  fetchPerformance,
  fetchReceiptById,
  fetchReceiptHistory,
  fetchSupplierById,
  fetchSupplyRequestById,
  fetchSupplyRequests,
  insertCompanyDocument,
  listCompanyDocuments,
  markAllNotificationsRead,
  markNotificationRead,
  rejectApplication,
  requestApplicationRevision,
  saveEvaluation,
  setApplicationUnderReview,
  setSupplierStatus,
  submitSupplyRequest,
  updateArrivalStatus,
  updateCompanyProfile,
  updateReceipt,
  updateSupplyRequest,
} from "../store.js";

/* Resolve the authenticated principal (auth.js requireVendor) and expose it
   with the request IP for audit logging. */
const actor = (req) => ({ ...req.user, ip: req.ip });

const router = Router();

router.get(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    res.json(await fetchBootstrap(actor(req)));
  })
);

router.post(
  "/session/touch",
  asyncHandler(async (req, res) => {
    /* requireVendor already slides the 30-minute inactivity window on every
       /api/vendor request, so this lightweight route is what a UI-side
       "Stay Logged In" / activity heartbeat calls to extend the server
       session without touching any data. */
    res.json({ ok: true, expiresAt: new Date(Date.now() + config.session.timeoutMinutes * 60_000).toISOString() });
  })
);

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    res.json(await fetchDashboard(actor(req)));
  })
);

router.get(
  "/suppliers",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json((await fetchBootstrap(actor(req))).suppliers);
  })
);

router.get(
  "/suppliers/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const supplier = await fetchSupplierById(req.params.id, actor(req));
    if (!supplier) throw httpError(404, "Supplier not found.");
    res.json(supplier);
  })
);

router.patch(
  "/suppliers/:id/status",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await setSupplierStatus(req.params.id, req.body?.status, actor(req)));
  })
);

router.patch(
  "/arrivals/:id/status",
  asyncHandler(async (req, res) => {
    res.json(await updateArrivalStatus(req.params.id, req.body?.status, actor(req)));
  })
);

router.get(
  "/receiving",
  asyncHandler(async (req, res) => {
    res.json((await fetchBootstrap(actor(req))).receipts);
  })
);

router.get(
  "/receiving/history",
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === "string" && req.query.from.trim() ? req.query.from.trim() : undefined;
    const to = typeof req.query.to === "string" && req.query.to.trim() ? req.query.to.trim() : undefined;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !re.test(from)) throw httpError(400, "Invalid From date. Use the format YYYY-MM-DD.");
    if (to && !re.test(to)) throw httpError(400, "Invalid To date. Use the format YYYY-MM-DD.");
    if (from && to && from > to) throw httpError(400, "The From date cannot be later than the To date.");
    res.json(await fetchReceiptHistory(actor(req), { fromDate: from, toDate: to }));
  })
);

/* Receiving Auto Report (PDF) — password-verified, staff-scoped.
   Step 1: the user proves their own account password (backend bcrypt check).
   Step 2: uses the short-lived grant from step 1 to generate the PDF. */
router.post(
  "/receiving/report/verify",
  requireRole("admin", "receiving_staff"),
  asyncHandler(async (req, res) => {
    res.json(await verifyReceivingReportPassword({ user: req.user, password: req.body?.password, ip: req.ip }));
  })
);

router.post(
  "/receiving/report",
  requireRole("admin", "receiving_staff"),
  asyncHandler(async (req, res) => {
    const from = typeof req.body?.from === "string" && req.body.from.trim() ? req.body.from.trim() : undefined;
    const to = typeof req.body?.to === "string" && req.body.to.trim() ? req.body.to.trim() : undefined;
    res.json(
      await generateReceivingReport({
        user: req.user,
        grant: req.body?.grant,
        from,
        to,
        ip: req.ip,
      })
    );
  })
);

router.get(
  "/receiving/:id",
  asyncHandler(async (req, res) => {
    const receipt = await fetchReceiptById(req.params.id, actor(req));
    if (!receipt) throw httpError(404, "Receiving transaction not found.");
    res.json(receipt);
  })
);

router.post(
  "/receiving",
  asyncHandler(async (req, res) => {
    const receipt = await createReceipt(req.body, actor(req));
    res.status(201).json(receipt);
  })
);

router.put(
  "/receiving/:id",
  asyncHandler(async (req, res) => {
    res.json(await updateReceipt(req.params.id, req.body, actor(req)));
  })
);

router.post(
  "/receiving/:id/confirm",
  asyncHandler(async (req, res) => {
    res.json(await confirmReceipt(req.params.id, actor(req)));
  })
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    res.json((await fetchBootstrap(actor(req))).notifications);
  })
);

router.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    res.json(await markNotificationRead(req.params.id, actor(req)));
  })
);

router.post(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    res.json(await markAllNotificationsRead(actor(req)));
  })
);

router.delete(
  "/notifications/clear",
  asyncHandler(async (req, res) => {
    res.json(await clearNotifications(actor(req)));
  })
);

router.get(
  "/supply-requests",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await fetchSupplyRequests(req.user.vendorId));
  })
);

router.get(
  "/supply-requests/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const request1 = await fetchSupplyRequestById(req.params.id, req.user.vendorId);
    if (!request1) throw httpError(404, "Supply request not found.");
    res.json(request1);
  })
);

router.post(
  "/supply-requests",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const request1 = await createSupplyRequest(req.body, actor(req));
    res.status(201).json(request1);
  })
);

router.put(
  "/supply-requests/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await updateSupplyRequest(req.params.id, req.body, actor(req)));
  })
);

router.post(
  "/supply-requests/:id/submit",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await submitSupplyRequest(req.params.id, actor(req)));
  })
);

router.post(
  "/supply-requests/:id/cancel",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await cancelSupplyRequest(req.params.id, actor(req)));
  })
);

router.get(
  "/company",
  asyncHandler(async (req, res) => {
    res.json(await fetchCompanyProfile(actor(req)));
  })
);

router.patch(
  "/company",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await updateCompanyProfile(actor(req), req.body));
  })
);

/* File upload whitelist — the only document types the Vendor Management
   module will ever accept or serve back. */
const ALLOWED_DOC_UPLOAD = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/zip": [".zip"],
};
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const UPLOAD_ROOT = join(process.cwd(), "uploads", "company");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_DOC_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname?.replace(/\0/g, "") ?? "";
    const ext = extname(name).toLowerCase().replace(/^\./, "");
    const allowedExt = ALLOWED_DOC_UPLOAD[file.mimetype] ?? [];
    if (!allowedExt.includes(`.${ext}`)) {
      return cb(new Error(`File type not allowed. Accepted types: ${Object.keys(ALLOWED_DOC_UPLOAD).join(", ")}.`));
    }
    cb(null, true);
  },
});

router.get(
  "/company/documents",
  asyncHandler(async (req, res) => {
    res.json(await listCompanyDocuments(actor(req)));
  })
);

router.post(
  "/company/documents",
  requireRole("admin"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw httpError(400, "No file was uploaded.");
    const vendorId = req.user.vendorId;
    const docDir = join(UPLOAD_ROOT, vendorId);
    await fsMkdir(docDir);
    await fsMove(file.path, join(docDir, file.filename));
    const result = await insertCompanyDocument({
      user: actor(req),
      vendorId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
    res.status(201).json(result);
  })
);

router.get(
  "/company/documents/:id/download",
  asyncHandler(async (req, res) => {
    const doc = await fetchCompanyDocument(req.params.id, actor(req));
    if (!doc) throw httpError(404, "Document not found.");
    const safeName = doc.originalName.replace(/[/\\]/g, "_").replace(/\0/g, "");
    res.download(join(UPLOAD_ROOT, doc.vendorId, doc.storedName), safeName);
  })
);

router.delete(
  "/company/documents/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const doc = await fetchCompanyDocument(req.params.id, actor(req));
    if (!doc) throw httpError(404, "Document not found.");
    await fsUnlink(join(UPLOAD_ROOT, doc.vendorId, doc.storedName)).catch(() => {});
    res.json(await deleteCompanyDocument(req.params.id, actor(req)));
  })
);

/* ── supplier sourcing / applications ──────────────────── */

const UPLOAD_APP_ROOT = join(process.cwd(), "uploads", "applications");

router.get(
  "/applications",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await fetchApplications(actor(req)));
  })
);

router.get(
  "/applications/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const app = await fetchApplicationById(req.params.id, actor(req));
    if (!app) throw httpError(404, "Supplier application not found.");
    res.json(app);
  })
);

router.post(
  "/applications/:id/under-review",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await setApplicationUnderReview(req.params.id, actor(req)));
  })
);

router.post(
  "/applications/:id/approve",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await approveApplication(req.params.id, actor(req)));
  })
);

router.post(
  "/applications/:id/reject",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await rejectApplication(req.params.id, req.body?.reason, actor(req)));
  })
);

router.post(
  "/applications/:id/revision",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await requestApplicationRevision(req.params.id, req.body?.note, actor(req)));
  })
);

router.get(
  "/applications/:id/documents/:docId/download",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const doc = await fetchApplicationDocument(req.params.id, req.params.docId, actor(req));
    const safeName = doc.original_name.replace(/[/\\]/g, "_").replace(/\0/g, "");
    res.download(join(UPLOAD_APP_ROOT, req.params.id, doc.stored_name), safeName);
  })
);

/* ── evaluations / performance / audit ─────────────────── */

router.get(
  "/evaluations",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await fetchEvaluations(actor(req)));
  })
);

router.post(
  "/evaluations",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.status(201).json(await saveEvaluation(req.body ?? {}, actor(req)));
  })
);

router.get(
  "/performance",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await fetchPerformance(actor(req)));
  })
);

router.get(
  "/audit-logs",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json(await fetchAuditLogs(actor(req)));
  })
);

const fsMkdir = (dir) => import("node:fs/promises").then((m) => m.mkdir(dir, { recursive: true }));
const fsMove = (from, to) => import("node:fs/promises").then((m) => m.rename(from, to));
const fsUnlink = (p) => import("node:fs/promises").then((m) => m.unlink(p));

export default router;