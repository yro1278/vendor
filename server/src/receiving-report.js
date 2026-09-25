import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import PDFDocument from "pdfkit";
import { pool } from "./db/pool.js";
import { config } from "./config.js";
import { httpError } from "./util.js";
import { logAudit } from "./audit.js";

/* ── Receiving Auto Report (PDF) ──────────────────────────────────────────
   Flow: the authenticated user proves ownership of their account by sending
   their account password. The password is verified here against the stored
   bcrypt hash — never on the frontend, never written anywhere, never
   returned in a response. On success a short-lived, single-purpose JWT grant
   is issued and the receiving PDF report is generated server-side from the
   actual MySQL records. */

const REPORT_GRANT_SCOPE = "receiving-report";
const REPORT_GRANT_TTL = "2m";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

const failedAttempts = new Map(); /* userId -> { fails, lockedUntil } */
const inFlight = new Set();       /* userId — one password verification at a time */
const usedGrants = new Set();     /* grant nonces — single-use */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fmt = (n) => Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
const fmtDateTime = (v) => String(v ?? "").slice(0, 16).replace(" ", " ");
const RECEIPT_HAS_ISSUE_TEXT = "Issues/Damaged";

function validateRange(from, to) {
  if (from !== undefined && !DATE_RE.test(from)) throw httpError(400, "Invalid From date. Use the format YYYY-MM-DD.");
  if (to !== undefined && !DATE_RE.test(to)) throw httpError(400, "Invalid To date. Use the format YYYY-MM-DD.");
  if (from && to && from > to) throw httpError(400, "The From date cannot be later than the To date.");
}

/* Verifies the given password against the authenticated user's own stored
   bcrypt hash. Throws a generic error on failure; only issues a grant on
   success. */
export async function verifyReceivingReportPassword({ user, password, ip = "" }) {
  const pw = typeof password === "string" ? password : "";
  if (!pw) throw httpError(400, "Password is required.");

  const now = Date.now();
  const entry = failedAttempts.get(user.sub) ?? { fails: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    const secs = Math.ceil((entry.lockedUntil - now) / 1000);
    throw httpError(429, `Too many failed attempts. Please try again in ${secs} seconds.`);
  }
  if (inFlight.has(user.sub)) {
    throw httpError(409, "A password verification is already in progress. Please wait.");
  }

  inFlight.add(user.sub);
  try {
    const [rows] = await pool.query("SELECT id, password_hash, display_name FROM users WHERE id = ?", [user.sub]);
    const hash = rows.length > 0 ? rows[0].password_hash : "";
    const ok = hash ? await bcrypt.compare(pw, hash) : false;
    if (!ok) {
      const fails = entry.fails + 1;
      if (fails >= MAX_FAILED_ATTEMPTS) {
        failedAttempts.set(user.sub, { fails: 0, lockedUntil: Date.now() + LOCKOUT_MS });
      } else {
        failedAttempts.set(user.sub, { fails, lockedUntil: 0 });
      }
      throw httpError(400, "Incorrect password. Please try again.");
    }

    failedAttempts.delete(user.sub);
    const grant = jwt.sign(
      { scope: REPORT_GRANT_SCOPE, sub: user.sub, nonce: randomUUID() },
      config.jwt.secret,
      { expiresIn: REPORT_GRANT_TTL }
    );
    return { ok: true, grant };
  } finally {
    inFlight.delete(user.sub);
    void ip;
  }
}

function assertGrant(grant, user) {
  let payload;
  try {
    payload = jwt.verify(grant, config.jwt.secret);
  } catch {
    throw httpError(400, "The report session is invalid or has expired. Verify your password again.");
  }
  if (payload.scope !== REPORT_GRANT_SCOPE || Number(payload.sub) !== Number(user.sub)) {
    throw httpError(400, "The report session is invalid. Verify your password again.");
  }
  if (usedGrants.has(payload.nonce)) {
    throw httpError(400, "The report session has already been used. Verify your password again.");
  }
  usedGrants.add(payload.nonce);
  return payload;
}

/* Builds the report from real MySQL records and returns a base64 PDF. Throws
   when there are no records in the selected range. */
export async function generateReceivingReport({ user, grant, from, to, ip = "" }) {
  assertGrant(grant, user);
  const vendorId = user.vendorId;
  if (from !== undefined && from !== "" && !DATE_RE.test(from)) throw httpError(400, "Invalid From date.");
  if (to !== undefined && to !== "" && !DATE_RE.test(to)) throw httpError(400, "Invalid To date.");

  const where = ["vendor_id = ?"];
  const params = [vendorId];
  if (from) {
    where.push("received_at >= ?");
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push("received_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(to);
  }

  const [receipts] = await pool.query(
    `SELECT id, arrival_id, supplier_id, supplier_name, status, total_qty, received_at, receiving_by, doc_ref, remarks
     FROM receipts WHERE ${where.join(" AND ")} ORDER BY received_at DESC`,
    params
  );
  if (receipts.length === 0) {
    throw httpError(400, "No receiving records found for the selected date range.");
  }

  const ids = receipts.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const [items] = await pool.query(
    `SELECT receipt_id, product_name, qty, unit, condition_value FROM receipt_items WHERE receipt_id IN (${placeholders}) ORDER BY id`,
    ids
  );

  const arrivalIds = [...new Set(receipts.map((r) => r.arrival_id).filter(Boolean))];
  const expectedByArrival = new Map();
  if (arrivalIds.length > 0) {
    const arrPlaceholders = arrivalIds.map(() => "?").join(",");
    const [arrivals] = await pool.query(
      `SELECT id, total_qty FROM arrivals WHERE id IN (${arrPlaceholders})`,
      arrivalIds
    );
    for (const a of arrivals) expectedByArrival.set(a.id, Number(a.total_qty));
  }

  const itemsByReceipt = new Map();
  for (const it of items) {
    if (!itemsByReceipt.has(it.receipt_id)) itemsByReceipt.set(it.receipt_id, []);
    itemsByReceipt.get(it.receipt_id).push(it);
  }

  let sumExpected = 0;
  let sumReceived = 0;
  let sumGood = 0;
  let sumDamaged = 0;
  const rows = receipts.map((r) => {
    const its = itemsByReceipt.get(r.id) ?? [];
    const good = its.filter((i) => i.condition_value === "good").reduce((a, i) => a + Number(i.qty), 0);
    const damaged = its.filter((i) => i.condition_value !== "good").reduce((a, i) => a + Number(i.qty), 0);
    const expected = r.arrival_id && expectedByArrival.has(r.arrival_id) ? Number(expectedByArrival.get(r.arrival_id)) : null;
    sumReceived += Number(r.total_qty);
    sumGood += good;
    sumDamaged += damaged;
    if (expected != null) sumExpected += expected;
    return {
      id: r.id,
      docRef: r.doc_ref ?? "",
      supplier: r.supplier_name,
      items: its.map((i) => `${i.product_name} (${fmt(i.qty)} ${i.unit}${i.condition_value === "good" ? "" : ` · ${i.condition_value}`})`).join("\n") || "—",
      expected,
      received: Number(r.total_qty),
      good,
      damaged,
      receivedAt: fmtDateTime(r.received_at),
      status: damaged > 0 ? RECEIPT_HAS_ISSUE_TEXT : "Received",
      receivedBy: r.receiving_by,
      remarks: (r.remarks ?? "").trim() || "—",
    };
  });

  const pdf = await buildPdf({
    rows,
    generatedBy: user.displayName ?? user.username ?? "",
    from: from ?? "",
    to: to ?? "",
    summary: { records: rows.length, expected: sumExpected, received: sumReceived, good: sumGood, damaged: sumDamaged },
  });

  const stamp = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filename = `TriM-Received-Report-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.pdf`;

  const rangeLabel = from || to ? `${from} to ${to}` : "All receiving history";
  await logAudit({
    user,
    action: "receiving.report.generate",
    entityType: "receiving_report",
    detail: `Receiving PDF report generated — ${rows.length} record(s), range ${rangeLabel}.`,
    ip,
  });

  return { ok: true, filename, pdfBase64: pdf.toString("base64") };
}

/* ── PDF rendering (pdfkit, landscape Letter) ─────────────────────────── */

const PAGE = { width: 792, height: 612, margin: 30 };
const USABLE = PAGE.width - PAGE.margin * 2;
const COLUMNS = [
  { key: "id", title: "Ref No.", w: 58 },
  { key: "supplier", title: "Supplier", w: 88 },
  { key: "items", title: "Items Received", w: 97 },
  { key: "expected", title: "Expected", w: 46, right: true },
  { key: "received", title: "Received", w: 48, right: true },
  { key: "good", title: "Good", w: 42, right: true },
  { key: "damaged", title: "Damaged", w: 50, right: true },
  { key: "receivedAt", title: "Received Date/Time", w: 88 },
  { key: "status", title: "Status", w: 68 },
  { key: "receivedBy", title: "Received By", w: 56 },
];
COLUMNS.push({ key: "remarks", title: "Remarks", w: USABLE - COLUMNS.reduce((a, c) => a + c.w, 0) });

const FONT = "Helvetica";
const FONT_B = "Helvetica-Bold";

function wrap(text, doc, maxWidth, size) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && doc.widthOfString(test, { size }) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

function truncate(text, max) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function buildPdf({ rows, generatedBy, from, to, summary }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: PAGE.margin, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const VIOLET = "#5b21b6";
    const INK = "#1e293b";
    const MUTED = "#64748b";
    const LINE = "#e2e8f0";
    const HEAD_FILL = "#f1f5f9";
    const SUM_FILL = "#f5f3ff";

    let y = PAGE.margin;

    doc.font(FONT_B).fontSize(16).fillColor(VIOLET).text("Tri-M Global Logistics & Trading Inc.", PAGE.margin, y, { width: USABLE, align: "center" });
    y = doc.y + 4;
    doc.font(FONT).fontSize(13).fillColor(INK).text("Receiving Auto Report", PAGE.margin, y, { width: USABLE, align: "center" });
    y = doc.y + 12;

    const meta = [
      `Report type:  Receiving Records`,
      `Generated on:  ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" })}`,
      `Generated by:  ${generatedBy}`,
      `Date range:  ${from || to ? `${from} to ${to}` : "All receiving history"}`,
    ];
    doc.fontSize(9).fillColor(MUTED);
    for (const line of meta) {
      doc.text(line, PAGE.margin, y, { width: USABLE });
      y = doc.y + 1;
    }
    y += 6;

    /* Summary strip — Good + Damaged = Received in every generated report. */
    const cells = [
      ["Records", fmt(summary.records)],
      ["Expected Qty", fmt(summary.expected)],
      ["Received Qty", fmt(summary.received)],
      ["Good Qty", fmt(summary.good)],
      ["Damaged Qty", fmt(summary.damaged)],
    ];
    const gap = 8;
    const sumW = (USABLE - gap * (cells.length - 1)) / cells.length;
    doc.roundedRect(PAGE.margin, y, USABLE, 34, 6).fill(SUM_FILL);
    let x = PAGE.margin;
    for (const [label, val] of cells) {
      doc.font(FONT).fontSize(8).fillColor(MUTED).text(label, x + 4, y + 5, { width: sumW - 8, align: "center" });
      doc.font(FONT_B).fontSize(12).fillColor(INK).text(val, x + 4, y + 14, { width: sumW - 8, align: "center" });
      x += sumW + gap;
    }
    y += 40;

    y += 4;
    const rowHeight = 22;
    const headerH = 20;
    const footY = PAGE.height - PAGE.margin - 14;

    const cellValue = (r, c) => {
      if (c.key === "id") return r.docRef ? `${r.id}\nDoc ${r.docRef}` : r.id;
      if (c.key === "received") return fmt(r.received);
      if (c.key === "expected") return r.expected == null ? "—" : fmt(r.expected);
      if (c.key === "good") return fmt(r.good);
      if (c.key === "damaged") return fmt(r.damaged);
      if (c.key === "remarks") return truncate(r.remarks === "—" ? "" : r.remarks, 90);
      return r[c.key];
    };

    const heightFor = (r) => {
      let lines = 1;
      for (const c of COLUMNS) {
        const text = String(cellValue(r, c) ?? "");
        const n = Math.max(1, Math.ceil(text.split("\n").reduce((mx, ln) => Math.max(mx, wrap(ln, doc, c.w - 8, 8).length), 1)));
        lines = Math.max(lines, n);
      }
      return Math.max(rowHeight, lines * 10 + 8);
    };

    const ensure = (need) => {
      if (y + need > footY) {
        doc.addPage();
        y = PAGE.margin;
        drawHeader();
      }
    };

    const drawHeader = () => {
      doc.rect(PAGE.margin, y, USABLE, headerH).fill(HEAD_FILL);
      let hx = PAGE.margin;
      doc.font(FONT_B).fontSize(8).fillColor(INK);
      for (const c of COLUMNS) {
        doc.text(c.title, hx + 4, y + 6, { width: c.w - 8, align: c.right ? "right" : "left" });
        hx += c.w;
      }
      y += headerH;
    };

    const drawRow = (r) => {
      const need = heightFor(r);
      ensure(need);
      doc.strokeColor(LINE).lineWidth(0.5);
      let rx = PAGE.margin;
      let maxLines = 1;
      const prepared = COLUMNS.map((c) => {
        const text = String(cellValue(r, c) ?? "");
        const lines = text.split("\n").flatMap((ln) => wrap(ln, doc, c.w - 8, 8));
        maxLines = Math.max(maxLines, lines.length);
        return { c, lines };
      });
      const cellH = Math.max(need, maxLines * 10 + 6);
      for (const { c, lines } of prepared) {
        doc.rect(rx, y, c.w, cellH).stroke();
        doc.font(FONT).fontSize(8).fillColor(INK);
        let ty = y + 3;
        for (const ln of lines.slice(0, Math.floor(cellH / 10))) {
          doc.text(ln, rx + 4, ty, { width: c.w - 8, align: c.right ? "right" : "left", lineBreak: false });
          ty += 10;
        }
        rx += c.w;
      }
      y += cellH;
    };

    /* Page footer with page numbers across buffered pages. */
    const addFooters = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font(FONT).fontSize(8).fillColor(MUTED);
        doc.text(`Generated by the Tri-M Receiving module · ${new Date().toLocaleDateString("en-US")}`, PAGE.margin, PAGE.height - 20, { width: USABLE, align: "left" });
        doc.text(`Page ${i + 1} of ${range.count}`, PAGE.margin, PAGE.height - 20, { width: USABLE, align: "right" });
      }
    };

    drawHeader();
    for (const r of rows) drawRow(r);
    addFooters();
    doc.end();
  });
}