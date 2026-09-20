import { Router } from "express";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import multer from "multer";
import { asyncHandler, httpError } from "../util.js";
import {
  cancelSupplyRequest,
  clearNotifications,
  confirmReceipt,
  createReceipt,
  createSupplyRequest,
  deleteCompanyDocument,
  fetchBootstrap,
  fetchCompanyDocument,
  fetchCompanyProfile,
  fetchDashboard,
  fetchReceiptById,
  fetchSupplierById,
  fetchSupplyRequestById,
  fetchSupplyRequests,
  insertCompanyDocument,
  listCompanyDocuments,
  markAllNotificationsRead,
  markNotificationRead,
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

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    res.json(await fetchDashboard(actor(req)));
  })
);

router.get(
  "/suppliers",
  asyncHandler(async (req, res) => {
    res.json((await fetchBootstrap(actor(req))).suppliers);
  })
);

router.get(
  "/suppliers/:id",
  asyncHandler(async (req, res) => {
    const supplier = await fetchSupplierById(req.params.id, actor(req));
    if (!supplier) throw httpError(404, "Supplier not found.");
    res.json(supplier);
  })
);

router.patch(
  "/suppliers/:id/status",
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
  asyncHandler(async (req, res) => {
    res.json(await fetchSupplyRequests(req.user.vendorId));
  })
);

router.get(
  "/supply-requests/:id",
  asyncHandler(async (req, res) => {
    const request1 = await fetchSupplyRequestById(req.params.id, req.user.vendorId);
    if (!request1) throw httpError(404, "Supply request not found.");
    res.json(request1);
  })
);

router.post(
  "/supply-requests",
  asyncHandler(async (req, res) => {
    const request1 = await createSupplyRequest(req.body, actor(req));
    res.status(201).json(request1);
  })
);

router.put(
  "/supply-requests/:id",
  asyncHandler(async (req, res) => {
    res.json(await updateSupplyRequest(req.params.id, req.body, actor(req)));
  })
);

router.post(
  "/supply-requests/:id/submit",
  asyncHandler(async (req, res) => {
    res.json(await submitSupplyRequest(req.params.id, actor(req)));
  })
);

router.post(
  "/supply-requests/:id/cancel",
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
  asyncHandler(async (req, res) => {
    const doc = await fetchCompanyDocument(req.params.id, actor(req));
    if (!doc) throw httpError(404, "Document not found.");
    await fsUnlink(join(UPLOAD_ROOT, doc.vendorId, doc.storedName)).catch(() => {});
    res.json(await deleteCompanyDocument(req.params.id, actor(req)));
  })
);

const fsMkdir = (dir) => import("node:fs/promises").then((m) => m.mkdir(dir, { recursive: true }));
const fsMove = (from, to) => import("node:fs/promises").then((m) => m.rename(from, to));
const fsUnlink = (p) => import("node:fs/promises").then((m) => m.unlink(p));

export default router;