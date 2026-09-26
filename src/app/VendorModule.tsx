import * as React from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, PackagePlus, PackageSearch, PackageCheck, Building2, Bell,
  LogOut, Menu, X, Eye, EyeOff, FileDown, Search, ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Trash2,
  Clock, Truck, Boxes, ClipboardList, AlertTriangle, AlertCircle, Info, RefreshCw, Lock,
  CheckCircle2, CheckCircle, XCircle, PackageOpen, Users, Mail, Phone, MapPin, FileText,
  ClipboardPlus, Send, CalendarClock, ArrowDownUp,
} from "lucide-react";
import {
  Supplier, SupplyReceipt, SupplyArrival, SupplyItem, ReceiptItem, ReceiptCondition, SupplyStatus, AppNotification,
  UNIT_OPTIONS, SUPPLY_STATUS_CFG, CONDITION_LABEL, supplyStatusCfg,
  genId, fmtDate, fmtDateTime, arrivalAcceptedGood, arrivalHasIssue, arrivalVendorReceivedQty,
  supplierReceivedQty, VendorData, VendorActions,
  RequestPriority, SupplyRequest, SupplyRequestStatus, SupplyRequestInput, SupplyDeliveryDocument,
  REQUEST_PRIORITIES, REQUEST_PRIORITY_LABEL, REQUEST_STATUS_CFG,
  ROLE_LABELS, SystemRole,
} from "./vendor-data";
import { api, ApiError, getSessionUser, setSessionUser, setToken } from "./api";
import { usePagePersistence, useDraftPersistence, saveDraft, clearDraft } from "./draft-persistence";

/* ─────────────────────────────────────────────────────────
   TRI-M GLOBAL LOGISTICS & TRADING INC. — VENDOR MANAGEMENT
   Receiving & monitoring subsystem. Consumes supplier and
   supply information passed downstream by the Supply Chain
   subsystem. No supplier recruiting / sourcing happens here.
   ───────────────────────────────────────────────────────── */

type Page = "dashboard" | "receiving" | "monitor" | "request" | "suppliers" | "history";

type ReceivingPreset = { arrivalStatus: "expected" | "pending" | "partially_received" };
type HistoryPreset = { arrivalStatus?: SupplyStatus; from?: string; to?: string };

const RECEIVE_PRESET_LABEL: Record<ReceivingPreset["arrivalStatus"], string> = {
  expected: "Expected Deliveries",
  pending: "Pending Receiving",
  partially_received: "Partially Received",
};

const inp = "w-full min-h-[44px] px-3.5 py-2.5 text-[15px] sm:text-sm border border-slate-200 rounded-xl bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b21b6]/20 focus:border-[#5b21b6]/40 transition-colors";
const selectCls = `${inp} cursor-pointer appearance-none`;

const Btn = ({ variant = "primary", size = "md", className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "warning" | "danger"; size?: "sm" | "md" }) => {
  const v = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : variant === "warning" ? "btn-warning" : variant === "danger" ? "btn-danger" : "btn-ghost";
  const sz = size === "sm" ? "px-3.5 py-2 text-xs" : "px-4 py-2.5 text-sm";
  return <button className={`btn ${v} ${sz} ${className}`} {...rest}>{children}</button>;
};

const Card = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div className={`surface ${className}`} onClick={onClick}>{children}</div>
);

const Field = ({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {hint && <p className="text-xs text-slate-400 -mt-1">{hint}</p>}
    {children}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const MonoId = ({ id }: { id: string }) => (
  <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded tracking-tight">{id}</span>
);

const SupplyBadge = ({ status }: { status: SupplyStatus | string }) => {
  const c = supplyStatusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}
    </span>
  );
};

const SupStatusPill = ({ status }: { status: "active" | "inactive" }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "bg-green-500" : "bg-slate-400"}`} />{status === "active" ? "Active" : "Inactive"}
  </span>
);

const ConditionPill = ({ condition }: { condition: ReceiptCondition }) => {
  const m: Record<ReceiptCondition, string> = {
    good: "bg-green-50 text-green-700 border-green-200",
    damaged: "bg-orange-50 text-orange-700 border-orange-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${m[condition]}`}>{CONDITION_LABEL[condition]}</span>;
};

/* The Vendor module's only receiving function is the final acknowledgment of
   checker-accepted stock, so every record here is simply "Received". There is
   no vendor-side condition state — damaged/rejected belong to the Checker. */
const ReceiptStatusPill = () => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-green-50 text-green-700 border-green-200"><CheckCircle2 size={12} /> Received</span>
);

const RequestStatusBadge = ({ status }: { status: SupplyRequestStatus }) => {
  const c = REQUEST_STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}
    </span>
  );
};

const PriorityPill = ({ priority }: { priority: RequestPriority }) => {
  const m: Record<RequestPriority, string> = {
    low: "bg-slate-50 text-slate-600 border-slate-200",
    normal: "bg-sky-50 text-sky-700 border-sky-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    urgent: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${m[priority]}`}>{REQUEST_PRIORITY_LABEL[priority]}</span>;
};

const FulfillmentTag = ({ progress }: { progress: SupplyRequest["fulfillment"]["progress"] }) =>
  progress === "fulfilled"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-green-50 text-green-700 border-green-200"><CheckCircle2 size={11} /> Full</span>
    : progress === "partial"
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-orange-50 text-orange-700 border-orange-200"><RefreshCw size={11} /> Partial</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-slate-50 text-slate-500 border-slate-200">Pending</span>;

const KpiCard = ({ icon, label, value, sub, color, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color: string; onClick?: () => void }) => {
  const inner = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
    </div>
  );
  if (!onClick) return <Card className="p-5 card-hover">{inner}</Card>;
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="text-left w-full rounded-2xl cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
      <Card className="p-5 card-hover hover:shadow-md">{inner}</Card>
    </button>
  );
};

const ProgressBar = ({ received, total, bad }: { received: number; total: number; bad?: boolean }) => {
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const color = bad ? "bg-red-500" : pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-[#5b21b6]" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <span className="text-[11px] text-slate-500 whitespace-nowrap">{received.toLocaleString()} / {total.toLocaleString()}</span>
    </div>
  );
};

const Modal = ({ open, onClose, title, children, footer, maxW = "max-w-[640px]" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; maxW?: string }) => {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center pt-14 px-4 sm:px-6">
      <div className="modal-backdrop absolute top-14 inset-x-0 bottom-0 bg-black/40" onClick={onClose} />
      <div className={`modal-panel relative z-10 bg-white flex flex-col rounded-2xl shadow-2xl w-full ${maxW} max-h-[86vh] overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 truncate">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100 p-2 -mr-2 shrink-0"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 py-4 bg-white">{footer}</div>}
      </div>
    </div>,
    document.getElementById("modal-portal") ?? document.body
  );
};

const ReceiptDetailsModal = ({ rec, onClose }: { rec: SupplyReceipt | null; onClose: () => void }) => (
  <Modal open={!!rec} onClose={onClose} title={rec ? `Receiving Record · ${rec.id}` : "Receiving Record"} maxW="max-w-[680px]"
    footer={rec && (
      <div className="flex flex-wrap justify-end gap-3">
        <Btn variant="secondary" size="sm" onClick={onClose}>Close</Btn>
      </div>
    )}>
    {rec && (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><MonoId id={rec.id} /><ReceiptStatusPill /></div>
        {[
          { k: "Supplier", v: `${rec.supplierName}`, i: <Building2 size={14} /> },
          { k: "Expected Supply", v: rec.arrivalId || "Ad-hoc receiving (no linked schedule)", i: <PackageOpen size={14} /> },
          { k: "Date Received", v: fmtDateTime(rec.receivedAt), i: <Clock size={14} /> },
          { k: "Received By", v: rec.receivingBy, i: <Users size={14} /> },
          { k: "Document / Reference", v: rec.docRef, i: <FileText size={14} /> },
          { k: "Remarks", v: rec.remarks || "—", i: <Info size={14} /> },
        ].map(r => (
          <div key={r.k} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
            <div className="text-slate-400 mt-0.5">{r.i}</div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{r.k}</p>
              <p className="text-sm text-slate-700 break-words">{r.v}</p>
            </div>
          </div>
        ))}
        <div>
          <p className="text-sm font-bold text-slate-700 mb-2">Received Items</p>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {rec.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-sm text-slate-700">{it.productName}</span>
                <span className="flex items-center gap-2"><strong className="text-slate-800 text-sm">{it.qty.toLocaleString()} {it.unit}</strong><ConditionPill condition={it.condition} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </Modal>
);

/* ── receiving auto report (PDF) viewer ───────────────────
   The generated report is shown inside an in-app modal rather than a
   separate browser tab, so no development-origin URL (e.g. a blob
   URL derived from localhost) is ever visible to the user. */
const PdfViewerModal = ({ data, onClose, titleLabel = "Receiving Report" }: { data: { pdfBase64: string; filename: string } | null; onClose: () => void; titleLabel?: string }) => {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    const bin = atob(data.pdfBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setUrl(u);
    return () => { setUrl(null); URL.revokeObjectURL(u); };
  }, [data]);

  return (
    <Modal open={!!data && !!url} onClose={onClose} title={data ? `${titleLabel} · ${data.filename}` : titleLabel} maxW="max-w-4xl"
      footer={data && (
        <div className="flex flex-wrap justify-end gap-3">
          {url && (
            <a href={url} download={data.filename} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#5b21b6] text-white hover:bg-[#4c1d95] transition-colors"><FileDown size={13} /> Download PDF</a>
          )}
          <Btn variant="secondary" size="sm" onClick={onClose}>Close</Btn>
        </div>
      )}>
      {data && url && (
        <iframe title={data.filename} src={url} className="w-full h-[68vh] rounded-xl border border-slate-200" />
      )}
    </Modal>
  );
};

const ReportPasswordModal = ({ open, onClose, from, to, onPdfGenerated }: {
  open: boolean;
  onClose: () => void;
  from: string;
  to: string;
  onPdfGenerated: (pdfBase64: string, filename: string) => void;
}) => {
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [phase, setPhase] = React.useState<"idle" | "verifying" | "generating">("idle");
  const [error, setError] = React.useState("");
  const busy = phase !== "idle";

  const requestClose = () => { if (!busy) onClose(); };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }
    setError("");
    setPhase("verifying");
    try {
      const v = await api.verifyReceivingReportPassword(password);
      setPhase("generating");
      const r = await api.generateReceivingReport(v.grant, {
        from: from.trim() || undefined,
        to: to.trim() || undefined,
      });
      setPassword("");
      onPdfGenerated(r.pdfBase64, r.filename);
      onClose();
    } catch (err) {
      setPhase("idle");
      setError(err instanceof ApiError ? err.message : "Failed to generate the receiving report. Please try again.");
    }
  };

  const btnLabel = phase === "verifying" ? "Verifying password…" : phase === "generating" ? "Generating report…" : "Verify & Generate";

  return (
    <Modal open={open} onClose={requestClose} title="Verify Password" maxW="max-w-sm"
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Btn variant="secondary" size="sm" onClick={requestClose} disabled={busy}>Cancel</Btn>
          <Btn size="sm" type="submit" form="report-password-form" disabled={busy}>
            <span className="inline-flex items-center gap-1.5">{busy ? <RefreshCw size={13} className="animate-spin" /> : <FileDown size={13} />}{btnLabel}</span>
          </Btn>
        </div>
      }>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Enter your account password to generate the receiving report.</p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0 mt-0.5" />{error}</div>
        )}
        <form id="report-password-form" onSubmit={handleVerify} className="space-y-1">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                className={`${inp} pr-11`}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                autoComplete="current-password"
                autoFocus
                disabled={busy}
              />
              <button type="button" onClick={() => setShow(v => !v)} disabled={busy}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
        </form>
        <p className="text-[11px] text-slate-400 leading-relaxed">For security, your password is verified by the server against your own account only. It is never stored, logged, or exposed in the report.</p>
      </div>
    </Modal>
  );
};

const LogoutConfirmModal = ({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) => (
  <Modal open={open} onClose={onClose} title="Logout" maxW="max-w-sm"
    footer={
      <div className="flex flex-wrap justify-end gap-3">
        <Btn variant="secondary" size="sm" onClick={onClose}>No</Btn>
        <Btn size="sm" onClick={onConfirm}><LogOut size={13} /> Yes</Btn>
      </div>
    }>
    <p className="text-sm text-slate-600 leading-relaxed">Are you sure you want to log out?</p>
  </Modal>
);

const SessionWarnModal = ({ open, busy, error, onStay, onLogout }: { open: boolean; busy: boolean; error: string; onStay: () => void; onLogout: () => void }) => (
  <Modal open={open} onClose={onLogout} title="Session Timeout" maxW="max-w-sm"
    footer={
      <div className="flex flex-wrap justify-end gap-3">
        <Btn variant="secondary" size="sm" disabled={busy} onClick={onLogout}>Log Out</Btn>
        <Btn size="sm" disabled={busy} onClick={onStay}>
          {busy ? <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-violet-300 border-t-transparent animate-spin" /> : <Clock size={13} />}
          Stay Logged In
        </Btn>
      </div>
    }>
    <p className="text-sm text-slate-600 leading-relaxed">Your session is about to expire.</p>
    <p className="text-sm text-slate-500 mt-1 leading-relaxed">You will be logged out due to inactivity.</p>
    {error && <p className="mt-3 text-xs text-red-600 leading-relaxed">{error}</p>}
  </Modal>
);

/* ── sign in ───────────────────────────────────────────── */

export const VendorLogin = ({ onLogin, notice }: { onLogin: (role: string) => void; notice?: string }) => {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !username || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username.trim(), password);
      setToken(res.token);
      setSessionUser(res.user);
      onLogin(res.user.role);
    } catch (err) {
      const offline = err instanceof ApiError && err.status === 0;
      if (offline) {
        setError("Cannot reach the vendor server. Check your connection and try again.");
      } else {
        setError("Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2e1065] to-[#5b21b6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Boxes size={28} className="text-violet-300" />
          </div>
          <h1 className="text-xl font-bold text-white">Tri-M Vendor Management</h1>
          <p className="text-sm text-violet-200 mt-1">Supply receiving &amp; monitoring · Authorized staff only</p>
        </div>
        <div className="surface !rounded-2xl p-7 shadow-2xl bg-white">
          <h2 className="text-lg font-bold text-slate-800">Sign In</h2>
          <p className="text-xs text-slate-500 mb-6">Record and monitor supplies received by Tri-M.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Username">
              <input className={inp} value={username} onChange={e => { setUsername(e.target.value); setError(""); }} placeholder="admin" autoComplete="username" />
            </Field>
            <Field label="Password">
              <input type="password" className={inp} value={password} onChange={e => { setPassword(e.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0" />{error}</div>}
            {notice && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs text-amber-700"><AlertCircle size={14} className="shrink-0" />{notice}</div>}
            <Btn type="submit" className="w-full" disabled={loading || !username || !password}>
              {loading ? <><RefreshCw size={15} className="animate-spin" /> Signing in…</> : <><Lock size={15} /> Sign In</>}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ── shell ─────────────────────────────────────────────── */

/* Role-based navigation. "receiving_staff" sees only receiving functions;
   "admin" additionally gets supplier management, supply requests, and the
   sourcing/evaluation/reporting pages. */
const NAV: { icon: React.ReactNode; label: string; page: Page; roles: readonly SystemRole[] }[] = [
  { icon: <LayoutDashboard size={17} />, label: "Dashboard", page: "dashboard", roles: ["admin", "receiving_staff"] },
  { icon: <PackagePlus size={17} />, label: "Receiving", page: "receiving", roles: ["admin", "receiving_staff"] },
  { icon: <PackageSearch size={17} />, label: "Supply Monitoring", page: "monitor", roles: ["admin", "receiving_staff"] },
  { icon: <ClipboardPlus size={17} />, label: "Request Supply", page: "request", roles: ["admin"] },
  { icon: <Building2 size={17} />, label: "Suppliers", page: "suppliers", roles: ["admin"] },
  { icon: <ClipboardList size={17} />, label: "Receiving History", page: "history", roles: ["admin", "receiving_staff"] },
];

/* Idle session timeout: the server (auth.js requireVendor) expires the session
   after 5 minutes of inactivity and slides the window on every /api/vendor
   request. The UI mirrors it — warn 1 minute before (4 min), expire at 5 min.
   These MUST stay in step with config.session.timeoutMinutes on the server. */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_WARN_MS = 4 * 60 * 1000;
const IDLE_HEARTBEAT_MS = 60 * 1000;

type Props = {
  role: SystemRole;
  data: VendorData;
  actions: VendorActions;
  loading?: boolean;
  error?: string | null;
  onLogout: () => void;
  onSessionExpired?: () => void;
};

export default function VendorManagement(props: Props) {
  const { role, data, actions, loading = false, error = null, onLogout } = props;
  const [page, setPage, pageLoaded] = usePagePersistence<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [receivingPreset, setReceivingPreset] = React.useState<ReceivingPreset | null>(null);
  const [historyPreset, setHistoryPreset] = React.useState<HistoryPreset | null>(null);
  const [requestFilterPreset, setRequestFilterPreset] = React.useState<RequestFilterKey | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [logoutConfirm, setLogoutConfirm] = React.useState(false);
  const bellRef = React.useRef<HTMLButtonElement | null>(null);

  /* ── Idle session timeout (mirrors the server-side sliding window) ──
     The backend already expires the session after 5 minutes without any
     /api/vendor request (auth.js requireVendor). This UI layer matches that
     window: it warns 1 minute before the timeout and, on "Stay Logged In",
     calls the server so the real session (not just the local timer) extends. */
  const [sessionWarnOpen, setSessionWarnOpen] = React.useState(false);
  const [sessionWarnErr, setSessionWarnErr] = React.useState("");
  const [sessionTouchBusy, setSessionTouchBusy] = React.useState(false);
  const lastActivityRef = React.useRef(Date.now());
  const lastTouchRef = React.useRef(0);
  const warnedRef = React.useRef(false);

  const expireSession = React.useCallback(() => {
    setSessionWarnOpen(false);
    props.onSessionExpired?.();
    props.onLogout();
  }, [props]);

  const touchSession = React.useCallback(
    async (force = false) => {
      if (!force && Date.now() - lastTouchRef.current < IDLE_HEARTBEAT_MS) return;
      lastTouchRef.current = Date.now();
      try {
        await api.touchSession();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          expireSession();
        }
      }
    },
    [expireSession]
  );

  React.useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      void touchSession();
    };
    for (const ev of events) window.addEventListener(ev, onActivity, { passive: true, capture: true });
    return () => {
      for (const ev of events) window.removeEventListener(ev, onActivity, { capture: true });
    };
  }, [touchSession]);

  React.useEffect(() => {
    const iv = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT_MS) {
        expireSession();
        return;
      }
      if (idle < IDLE_WARN_MS) {
        warnedRef.current = false;
        return;
      }
      if (!warnedRef.current) {
        warnedRef.current = true;
        setSessionWarnErr("");
        setSessionWarnOpen(true);
      }
    }, 5_000);
    return () => window.clearInterval(iv);
  }, [expireSession]);

  const handleStayLoggedIn = async () => {
    setSessionTouchBusy(true);
    setSessionWarnErr("");
    try {
      await api.touchSession();
      lastActivityRef.current = Date.now();
      lastTouchRef.current = Date.now();
      warnedRef.current = false;
      setSessionWarnOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expireSession();
      } else {
        setSessionWarnErr(
          e instanceof ApiError && e.message ? e.message : "Could not refresh your session. Check your connection and retry."
        );
      }
    } finally {
      setSessionTouchBusy(false);
    }
  };

  const toggleNotifs = () => setNotifOpen(o => !o);

  const navItems = NAV.filter(n => n.roles.includes(role));
  /* If the persisted/current page is outside this role's allowed set
     (e.g. a role was downgraded), fall back to the dashboard — never render
     an admin page for receiving staff. */
  const currentPage: Page = NAV.some(n => n.page === page && n.roles.includes(role)) ? (page as Page) : "dashboard";
  const unread = data.notifications.filter(n => !n.read).length;
  const currentLabel = NAV.find(n => n.page === currentPage)?.label ?? "Dashboard";
  const toNext = (p: Page) => { setPage(p); window.scrollTo({ top: 0 }); };

  const openReceiving = (preset: ReceivingPreset | null) => {
    setReceivingPreset(preset);
    setPage("receiving");
    window.scrollTo({ top: 0 });
  };

  const openHistory = (preset: HistoryPreset | null) => {
    setHistoryPreset(preset);
    setPage("history");
    window.scrollTo({ top: 0 });
  };

  const openRequests = (preset: RequestFilterKey | null) => {
    setRequestFilterPreset(preset);
    setPage("request");
    window.scrollTo({ top: 0 });
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => {
    const isCollapsed = mobile ? false : collapsed;
    return (
      <div className="flex flex-col h-full bg-[#1e0a4a]">
        <div className={`flex items-center gap-2.5 px-4 pt-5 pb-3 ${isCollapsed ? "px-2 justify-center" : ""}`}>
          <div className={`shrink-0 rounded-lg flex items-center justify-center border border-violet-400/30 bg-violet-400/20 ${isCollapsed ? "w-7 h-7" : "w-8 h-8"}`}>
            <Boxes size={isCollapsed ? 15 : 16} className="text-violet-300" />
          </div>
          {!isCollapsed && <div className="text-left leading-tight min-w-0"><div className="text-xs font-bold text-white tracking-wide truncate">TRI-M VENDOR</div><div className="text-[10px] text-slate-400 tracking-wider">RECEIVING &amp; MONITORING</div></div>}
        </div>
        <nav className={isCollapsed ? "flex-1 py-2 px-2 space-y-1" : "flex-1 overflow-y-auto py-2 px-3 space-y-1"}>
          {navItems.map(({ icon, label, page: p }) => (
            <button key={p} onClick={() => { setPage(p); setMobileOpen(false); if (p === "receiving") setReceivingPreset(null); if (p === "history") setHistoryPreset(null); if (p === "request") setRequestFilterPreset(null); }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${isCollapsed ? "justify-center" : ""} ${currentPage === p ? "bg-violet-500/20 text-white" : "text-slate-300 hover:text-white hover:bg-white/5"}`}>
              {icon}
              {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
              {isCollapsed && <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">{label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 pt-2 pb-4 mt-auto space-y-1">
          <button onClick={() => setLogoutConfirm(true)} className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-red-400 hover:bg-red-500/10 ${isCollapsed ? "justify-center" : ""}`}>
            <LogOut size={16} />{!isCollapsed && <span className="flex-1 text-left">Logout</span>}
            {isCollapsed && <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100">Logout</span>}
          </button>
          {!mobile && (
            <button onClick={() => setCollapsed(c => !c)} className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 ${isCollapsed ? "justify-center" : ""}`}>
              {isCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="flex-1 text-left">Collapse Sidebar</span></>}
              {isCollapsed && <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100">Expand Sidebar</span>}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className={`hidden lg:flex shrink-0 bg-[#1e0a4a] transition-[width] duration-300 ease-in-out ${collapsed ? "w-[76px]" : "w-64"}`}>
        <Sidebar />
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex overflow-hidden">
          <div className="drawer-backdrop absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="drawer-panel relative w-64 max-w-[80%] h-full shadow-2xl bg-[#1e0a4a]"><Sidebar mobile /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <header className="bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"><Menu size={20} /></button>
            <h2 className="font-bold text-slate-800 text-sm truncate">{currentLabel}</h2>
          </div>
<div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {ROLE_LABELS[role] ?? "Authorized Staff"}</span>
              <button ref={bellRef} onClick={toggleNotifs} aria-expanded={notifOpen} aria-haspopup="menu" className={`relative p-2 rounded-lg transition-colors ${notifOpen ? "text-[#5b21b6] bg-violet-50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`} title="Notifications" aria-label="Notifications">
                <Bell size={18} />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">{unread > 99 ? "99+" : unread}</span>}
              </button>
              <NotifPopover open={notifOpen} bellRef={bellRef} onClose={() => setNotifOpen(false)} data={data} actions={actions} />
            </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {loading ? (
            <div className="max-w-[1440px] mx-auto">
              <Card className="p-12 text-center">
                <RefreshCw size={26} className="text-[#5b21b6] mx-auto mb-3 animate-spin" />
                <p className="text-sm font-semibold text-slate-600">Loading vendor data…</p>
                <p className="text-xs text-slate-400 mt-1">Retrieving suppliers, expected supplies, and receiving records from the database.</p>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="max-w-[1440px] mx-auto bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />{error}
                </div>
              )}
              <div key={currentPage} className="page-enter mx-auto max-w-[1440px]">
                {currentPage === "dashboard" && <Dashboard role={role} data={data} goTo={toNext} actions={actions} onOpenReceiving={openReceiving} onOpenHistory={openHistory} onOpenRequests={openRequests} />}
                {currentPage === "receiving" && <Receiving data={data} actions={actions} goTo={toNext} preset={receivingPreset} onPresetConsumed={() => setReceivingPreset(null)} />}
                {currentPage === "monitor" && <SupplyMonitoring data={data} actions={actions} goTo={toNext} />}
                {currentPage === "request" && <RequestSupply data={data} actions={actions} goTo={toNext} preset={requestFilterPreset} onPresetConsumed={() => setRequestFilterPreset(null)} />}
                {currentPage === "suppliers" && <Suppliers data={data} actions={actions} />}
                {currentPage === "history" && <ReceivingHistory data={data} actions={actions} preset={historyPreset} onPresetConsumed={() => setHistoryPreset(null)} />}
              </div>
            </div>
          )}
        </main>
        <div id="modal-portal" />
        <LogoutConfirmModal open={logoutConfirm} onClose={() => setLogoutConfirm(false)} onConfirm={onLogout} />
        <SessionWarnModal
          open={sessionWarnOpen}
          busy={sessionTouchBusy}
          error={sessionWarnErr}
          onStay={() => void handleStayLoggedIn()}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}

/* ── dashboard ─────────────────────────────────────────── */

const Dashboard = ({ role, data, goTo, actions, onOpenReceiving, onOpenHistory, onOpenRequests }: {
  role: string; data: VendorData; goTo: (p: Page) => void;
  actions: VendorActions;
  onOpenReceiving: (preset: ReceivingPreset | null) => void;
  onOpenHistory: (preset: HistoryPreset | null) => void;
  onOpenRequests: (preset: RequestFilterKey | null) => void;
}) => {
  const { arrivals, receipts, suppliers, supplyRequests } = data;
  const [viewingRec, setViewingRec] = React.useState<SupplyReceipt | null>(null);
  const count = (s: SupplyStatus) => arrivals.filter(a => a.status === s).length;
  const expected = count("expected");
  const pendingCount = count("pending");
  const partial = count("partially_received");
  const completed = count("completed");

  /* Each request tile counts the SAME status group it navigates to, so the
     number on the tile can never disagree with the list it opens. */
  const countRequests = (key: Exclude<RequestFilterKey, "all">) =>
    supplyRequests.filter(r => REQUEST_FILTER_GROUPS[key].includes(r.status)).length;
  const pendingRequests = countRequests("active");
  const underReview = countRequests("under_review");
  const fulfilledRequests = countRequests("fulfilled");
  const partialRequests = countRequests("partially_fulfilled");

  const recentReceipts = [...receipts].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt)).slice(0, 5);
  const recentNotifs = data.notifications.slice(0, 4);
  const unreadNotifs = data.notifications.filter(n => !n.read).length;
  const upcoming = arrivals.filter(a => a.status === "expected" || a.status === "pending")
    .sort((a, b) => +a.expectedDate - +b.expectedDate).slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#5b21b6] text-white flex items-center justify-center"><Boxes size={24} /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Vendor Management Overview</h1>
            <p className="text-xs text-slate-400">Receive, record, and monitor supplies delivered to Tri-M.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn size="sm" onClick={() => onOpenReceiving(null)}><PackageCheck size={14} /> Record Received</Btn>
          <Btn size="sm" variant="secondary" onClick={() => goTo("monitor")}><PackageSearch size={14} /> Supply Monitoring</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        <KpiCard icon={<Clock size={18} className="text-sky-600" />} label="Expected Deliveries" value={expected} sub={expected > 0 ? "Awaiting arrival" : "No upcoming"} color="bg-sky-50" onClick={() => onOpenReceiving({ arrivalStatus: "expected" })} />
        <KpiCard icon={<Truck size={18} className="text-amber-600" />} label="Pending Receiving" value={pendingCount} sub="At facility, pending receive" color="bg-amber-50" onClick={() => onOpenReceiving({ arrivalStatus: "pending" })} />
        <KpiCard icon={<Boxes size={18} className="text-green-600" />} label="Supplies Received" value={receipts.length} sub="Total receiving transactions" color="bg-green-50" onClick={() => onOpenHistory(null)} />
        <KpiCard icon={<RefreshCw size={18} className="text-orange-600" />} label="Partially Received" value={partial} sub="Vendor acknowledgment pending" color="bg-orange-50" onClick={() => onOpenReceiving({ arrivalStatus: "partially_received" })} />
        <KpiCard icon={<PackageCheck size={18} className="text-indigo-600" />} label="Completed Receiving" value={completed} sub="Closed & forwarded" color="bg-indigo-50" onClick={() => onOpenHistory({ arrivalStatus: "completed" })} />
      </div>

      {role === "admin" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={<ClipboardPlus size={18} className="text-violet-600" />} label="Requests In Progress" value={pendingRequests} sub="Submitted → Fulfillment" color="bg-violet-50" onClick={() => onOpenRequests("active")} />
          <KpiCard icon={<Clock size={18} className="text-amber-600" />} label="Under Review" value={underReview} sub="With Supply Chain" color="bg-amber-50" onClick={() => onOpenRequests("under_review")} />
          <KpiCard icon={<RefreshCw size={18} className="text-orange-600" />} label="Partially Fulfilled" value={partialRequests} sub="Balance pending" color="bg-orange-50" onClick={() => onOpenRequests("partially_fulfilled")} />
          <KpiCard icon={<CheckCircle2 size={18} className="text-green-600" />} label="Requests Fulfilled" value={fulfilledRequests} sub="Fully delivered" color="bg-green-50" onClick={() => onOpenRequests("fulfilled")} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="p-5 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><ClipboardList size={16} /></div>
              <h3 className="text-sm font-bold text-slate-800">Recent Supply Receipts</h3>
            </div>
            <button onClick={() => onOpenHistory(null)} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-2">
            {recentReceipts.map(r => (
              <button key={r.id} type="button" onClick={() => setViewingRec({ ...r })} title="View receiving details" className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors cursor-pointer group">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 truncate"><MonoId id={r.id} /><span className="truncate">{r.supplierName}</span></p>
                  <p className="text-xs text-slate-400 truncate">{r.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0"><ReceiptStatusPill /><span className="text-[11px] text-slate-400 flex items-center gap-1">{fmtDateTime(r.receivedAt)}<Eye size={11} className="text-slate-300 group-hover:text-violet-500 transition-colors" /></span></div>
              </button>
            ))}
            {recentReceipts.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No receiving transactions yet.</p>}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-5">
<div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><Bell size={16} /></div>
                <h3 className="text-sm font-bold text-slate-800">Recent Notifications</h3>
              </div>
              {unreadNotifs > 0 && <span className="text-[11px] font-bold text-red-500">{unreadNotifs} unread</span>}
            </div>
          <div className="space-y-2">
            {recentNotifs.map(n => (
              <button key={n.id} type="button" onClick={() => actions.markNotifRead(n.id)} title={n.read ? "Notification" : "Mark as read"} className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-colors ${n.read ? "border-slate-100 hover:border-slate-200 hover:bg-slate-50" : "border-violet-200 bg-violet-50/40 hover:bg-violet-50/70"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{n.title}</span>
                  <span className={`text-[11px] ${n.read ? "text-slate-400" : "text-slate-500"} flex items-center gap-1`}>{fmtDate(n.timestamp)}{!n.read && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />}</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">{n.message}</p>
              </button>
            ))}
            {recentNotifs.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No notifications yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="p-5 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Truck size={16} /></div>
              <h3 className="text-sm font-bold text-slate-800">Expected Deliveries</h3>
            </div>
            <button onClick={() => goTo("monitor")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-2">
            {upcoming.map(a => (
              <button key={a.id} type="button" onClick={() => onOpenReceiving({ arrivalStatus: "expected" })} title="Open the expected deliveries list" className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors cursor-pointer group">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 truncate"><MonoId id={a.id} /><span className="truncate">{a.supplierName}</span></p>
                  <p className="text-xs text-slate-400 truncate">{a.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0"><SupplyBadge status={a.status} /><span className="text-[11px] text-slate-400 flex items-center gap-1">{fmtDate(a.expectedDate)} · {a.destination}<Eye size={11} className="text-slate-300 group-hover:text-violet-500 transition-colors" /></span></div>
              </button>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No expected deliveries.</p>}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><Building2 size={16} /></div>
            <h3 className="text-sm font-bold text-slate-800">Supplier Supply Summary</h3>
          </div>
          <div className="space-y-2">
            {suppliers.map(s => {
              const recQs = supplierReceivedQty(s.id, receipts);
              const expQs = arrivals.filter(a => a.supplierId === s.id).reduce((a, r) => a + r.totalQty, 0);
              const tx = receipts.filter(r => r.supplierId === s.id).length;
              return (
                <div key={s.id} className="p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{s.companyName}</p>
                    <SupStatusPill status={s.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                    <span>Expected: <strong className="text-slate-700">{expQs.toLocaleString()}</strong></span>
                    <span>Received: <strong className="text-slate-700">{recQs.toLocaleString()}</strong></span>
                    <span>Receipts: <strong className="text-slate-700">{tx}</strong></span>
                  </div>
                </div>
              );
            })}
            {suppliers.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No supplier records found.</p>}
          </div>
        </Card>
      </div>

      <ReceiptDetailsModal rec={viewingRec} onClose={() => setViewingRec(null)} />
    </div>
  );
};

/* ── request supply ────────────────────────────────────── */

type RequestItemEditorRow = { productId: number | ""; qty: number; unit: string; remarks: string };

type RequestFormDraft = {
  neededByDate: string;
  priority: RequestPriority;
  reason: string;
  remarks: string;
  items: RequestItemEditorRow[];
};

const emptyRequestItem = (): RequestItemEditorRow => ({ productId: "", qty: 1, unit: "pcs", remarks: "" });

const localTodayValue = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toDateInput = (iso: string) => {
  const s = (iso ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

const initialRequestDraft = (): RequestFormDraft => ({
  neededByDate: localTodayValue(),
  priority: "normal",
  reason: "",
  remarks: "",
  items: [emptyRequestItem()],
});

const RequestForm = ({ open, onClose, editing, data, actions }: {
  open: boolean;
  onClose: () => void;
  editing: SupplyRequest | null;
  data: VendorData;
  actions: VendorActions;
}) => {
  const [draft, setDraft, draftLoaded] = useDraftPersistence<RequestFormDraft>("request", initialRequestDraft(), editing?.id ?? "new");
  const [err, setErr] = React.useState("");
  const [fieldErr, setFieldErr] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const productById = React.useMemo(() => new Map(data.products.map(p => [p.id, p])), [data.products]);

  React.useEffect(() => {
    if (!open || !draftLoaded) return;
    if (editing) {
      setDraft({
        neededByDate: toDateInput(editing.neededByDate) || localTodayValue(),
        priority: editing.priority,
        reason: editing.reason,
        remarks: editing.remarks,
        items: editing.items.map(i => ({ productId: i.productId ?? "", qty: i.qty, unit: i.unit, remarks: i.remarks })),
      });
    } else {
      setDraft(initialRequestDraft());
    }
    setErr("");
    setFieldErr({});
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, draftLoaded]);

  const validate = (): { message: string; fields: Record<string, string> } | null => {
    const fields: Record<string, string> = {};
    if (!draft.neededByDate) fields.neededByDate = "Needed-by date is required.";
    if (draft.items.length === 0) fields.items = "Add at least one requested supply item.";
    else {
      const seen = new Set<string>();
      for (const it of draft.items) {
        if (it.productId === "" || !productById.has(String(it.productId))) { fields.items = "Each item needs a product selected from the product database."; break; }
        const q = Number(it.qty);
        if (!Number.isFinite(q) || q <= 0) { fields.items = "Each item quantity must be greater than zero."; break; }
        if (!it.unit.trim()) { fields.items = "Each item needs a unit."; break; }
        const key = `${String(it.productId)}::${it.unit}`;
        if (seen.has(key)) { fields.items = "Duplicate product in the same request is not allowed."; break; }
        seen.add(key);
      }
    }
    if (Object.keys(fields).length === 0) return null;
    return { message: fields[Object.keys(fields)[0]], fields };
  };

  const buildInput = (): SupplyRequestInput => ({
    neededByDate: draft.neededByDate,
    priority: draft.priority,
    reason: draft.reason.trim(),
    remarks: draft.remarks.trim(),
    items: draft.items.map(it => ({
      productId: Number(it.productId),
      qty: Number(it.qty),
      unit: it.unit.trim(),
      remarks: it.remarks.trim(),
    })),
  });

  const handleSave = async (submitAfter: boolean) => {
    setErr("");
    setFieldErr({});
    const v = validate();
    if (v) { setFieldErr(v.fields); setErr(v.message); return; }

    setSaving(true);
    try {
      const res = editing
        ? await actions.updateSupplyRequest(editing.id, buildInput())
        : await actions.createSupplyRequest(buildInput());
      if (!res.ok) {
        setFieldErr(mapFieldErrors(res.errors));
        setErr(res.error ?? "Failed to save the supply request.");
        return;
      }
      clearDraft("request", editing?.id ?? "new");
      onClose();
      if (submitAfter && res.id) void actions.submitSupplyRequest(res.id);
    } catch {
      setErr("Failed to save the supply request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${editing ? `Edit Supply Request · ${editing.id}` : "New Supply Request"}`} maxW="max-w-[760px]"
      footer={
        <div className="flex flex-col gap-3">
          {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0" />{err}</div>}
          <div className="flex flex-wrap gap-3 justify-end">
            <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn variant="secondary" size="sm" onClick={() => handleSave(false)} disabled={saving}>{saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save Draft</Btn>
            <Btn size="sm" onClick={() => handleSave(true)} disabled={saving}><Send size={14} /> {saving ? "Saving…" : "Save & Submit Request"}</Btn>
          </div>
        </div>
      }>
      <div className="space-y-5">
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2 text-xs text-violet-700"><Info size={14} className="shrink-0 mt-0.5" /> This request records the supplies Tri-M needs so they can be coordinated and delivered.</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Request Reference" hint="Generated automatically">
            <input className={`${inp} bg-slate-50 text-slate-500`} value={editing?.id ?? "VR-YYYY-NNNN"} disabled />
          </Field>
          <Field label="Requested By" hint="Current signed-in user">
            <input className={`${inp} bg-slate-50 text-slate-500`} value={getSessionUser()?.displayName?.trim() || "Administrator"} disabled />
          </Field>
          <Field label="Request Date" hint="Generated automatically">
            <input className={`${inp} bg-slate-50 text-slate-500`} value={editing ? fmtDateTime(editing.requestDate) : fmtDateTime(new Date().toISOString())} disabled />
          </Field>
          <Field label="Needed By Date" required error={fieldErr.neededByDate}>
            <div className="relative">
              <input type="date" className={`${inp} pr-9`} value={draft.neededByDate} onChange={e => setDraft(d => ({ ...d, neededByDate: e.target.value }))} />
              <CalendarClock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Priority" required>
            <div className="relative">
              <select className={selectCls} value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value as RequestPriority }))}>
                {REQUEST_PRIORITIES.map(p => <option key={p} value={p}>{REQUEST_PRIORITY_LABEL[p]}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
          <Field label="Reason / Purpose" required error={fieldErr.reason}>
            <input className={inp} value={draft.reason} onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))} placeholder="Why is this supply needed?" />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Requested Items — Product / Quantity / Unit</p>
            <button onClick={() => setDraft(d => ({ ...d, items: [...d.items, emptyRequestItem()] }))} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1"><Plus size={12} /> Add Item</button>
          </div>
          <div className="space-y-2">
            {draft.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.6fr_0.7fr_auto] gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                <div className="relative">
                  <select className={selectCls} value={it.productId} onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === idx ? { ...x, productId: e.target.value ? Number(e.target.value) : "" } : x) }))}>
                    <option value="">— Select product —</option>
                     {data.products.map(p => (
                       <option key={p.id} value={p.id}>{p.name}{p.brand ? ` · ${p.brand}` : ""} ({p.sku}{p.stock ? ` · Stock: ${p.stock}` : ""})</option>
                     ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <input type="number" min={1} className={inp} value={it.qty} onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === idx ? { ...x, qty: Number(e.target.value) } : x) }))} placeholder="Qty" />
                <div className="relative">
                  <select className={selectCls} value={it.unit} onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === idx ? { ...x, unit: e.target.value } : x) }))}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="flex gap-1">
                  <input className={`${inp} sm:w-full`} value={it.remarks} onChange={e => setDraft(d => ({ ...d, items: d.items.map((x, j) => j === idx ? { ...x, remarks: e.target.value } : x) }))} placeholder="Item remarks (optional)" />
                  <button onClick={() => setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))} disabled={draft.items.length === 1} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-red-600 disabled:opacity-30 shrink-0"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          {fieldErr.items && <p className="text-xs text-red-600 mt-2">{fieldErr.items}</p>}
          <div className="flex justify-end mt-3 text-sm"><span className="text-slate-500">Total items: <strong className="text-slate-800">{draft.items.length}</strong></span></div>
        </div>

        <div>
          <Field label="Remarks (optional)" hint="Additional notes for the Supply Chain team">
            <textarea className={`${inp} min-h-[76px]`} value={draft.remarks} onChange={e => setDraft(d => ({ ...d, remarks: e.target.value }))} placeholder="Optional notes…" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

const RequestDetail = ({ request, onClose, onEdit, actions }: {
  request: SupplyRequest;
  onClose: () => void;
  onEdit: () => void;
  actions: VendorActions;
}) => {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const run = async (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, id: string, msg: string) => {
    setBusy(true);
    setErr("");
    const res = await fn(id);
    setBusy(false);
    if (!res.ok) setErr(res.error ?? msg);
  };

  const line = (k: string, v: React.ReactNode, i: React.ReactNode) => (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="text-slate-400 mt-0.5">{i}</div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{k}</p>
        <p className="text-sm text-slate-700 break-words">{v}</p>
      </div>
    </div>
  );

  const full = request.fulfillment.progress === "fulfilled";
  const partial = request.fulfillment.progress === "partial";

  return (
    <Modal open={!!request} onClose={onClose} title={`Supply Request · ${request.id}`} maxW="max-w-[720px]"
      footer={
        <div className="flex flex-col gap-3">
          {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0" />{err}</div>}
          <div className="flex flex-wrap gap-3 justify-end">
            <Btn variant="secondary" size="sm" onClick={onClose}>Close</Btn>
            {request.status === "draft" && <Btn variant="secondary" size="sm" onClick={onEdit} disabled={busy}><Save size={13} /> Edit Draft</Btn>}
            {request.status === "draft" && <Btn size="sm" onClick={() => { if (confirm(`Submit ${request.id} for Supply Chain coordination?`)) run(actions.submitSupplyRequest, request.id, "Failed to submit the request."); }} disabled={busy}><Send size={13} /> Submit Request</Btn>}
            {(request.status === "draft" || request.status === "submitted") && <Btn variant="danger" size="sm" onClick={() => { if (confirm(`Cancel ${request.id}?`)) run(actions.cancelSupplyRequest, request.id, "Failed to cancel the request."); }} disabled={busy}><XCircle size={13} /> Cancel Request</Btn>}
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><MonoId id={request.id} /><RequestStatusBadge status={request.status} /></div>

        {line("Request Date", fmtDateTime(request.requestDate), <CalendarClock size={14} />)}
        {line("Requested By", getSessionUser()?.displayName?.trim() || "Administrator", <Users size={14} />)}
        {line("Needed By Date", fmtDate(request.neededByDate), <CalendarClock size={14} />)}
        {line("Priority", <PriorityPill priority={request.priority} />, <AlertTriangle size={14} />)}
        {line("Reason / Purpose", request.reason || "—", <FileText size={14} />)}
        {line("Remarks", request.remarks || "—", <Info size={14} />)}
        {request.submittedAt && line("Submitted", fmtDateTime(request.submittedAt), <Send size={14} />)}

        <div>
          <p className="text-sm font-bold text-slate-700 mb-2">Request Items</p>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-2">Product</th>
                  <th className="text-right px-4 py-2">Requested</th>
                  <th className="text-right px-4 py-2">Fulfilled</th>
                  <th className="text-right px-4 py-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((it) => {
                  const fl = request.fulfillment.items.find(f => f.productName === it.productName && f.unit === it.unit);
                  const requested = fl?.requestedQty ?? it.qty;
                  const fulfilled = fl?.fulfilledQty ?? 0;
                  const remaining = fl?.remainingQty ?? Math.max(0, requested);
                  return (
                    <tr key={it.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5"><p className="text-sm font-semibold text-slate-700">{it.productName}</p>{it.remarks && <p className="text-[11px] text-slate-400 mt-0.5">{it.remarks}</p>}</td>
                      <td className="px-4 py-2.5 text-right text-sm text-slate-800">{requested.toLocaleString()} {it.unit}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold text-green-700">{fulfilled.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-sm">{remaining <= 0 ? <span className="text-slate-400">0</span> : <span className="font-semibold text-amber-700">{remaining.toLocaleString()}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {partial && <p className="text-xs text-orange-600 mt-2 flex items-center gap-1"><RefreshCw size={12} /> Partially fulfilled — remaining quantities are pending from Supply Chain.</p>}
          {full && <p className="text-xs text-green-700 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> All requested quantities have been fulfilled.</p>}
          {!partial && !full && <p className="text-xs text-slate-400 mt-2">Fulfillment updates once the scheduled deliveries arrive.</p>}
        </div>

        {(request.scReference || request.supplierName || request.processingStatus || request.expectedDeliveryDate) && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-sky-700 mb-2 flex items-center gap-1"><Info size={12} /> Supply Chain Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
              {request.scReference && <div className="flex gap-2"><span className="text-slate-400">Supply Chain Ref:</span><MonoId id={request.scReference} /></div>}
              {request.processingStatus && <div className="flex gap-2"><span className="text-slate-400">Processing:</span><span className="font-semibold capitalize">{request.processingStatus}</span></div>}
              {request.supplierName && <div className="flex gap-2"><span className="text-slate-400">Supplier:</span><strong>{request.supplierName}</strong></div>}
              {request.expectedDeliveryDate && <div className="flex gap-2"><span className="text-slate-400">Expected Delivery:</span>{fmtDate(request.expectedDeliveryDate)}</div>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

/* Simplified request-status filter model. The backend keeps the full
   granular status set (draft/submitted/under_review/approved/processing/
   fulfillment_in_progress/partially_fulfilled/fulfilled/rejected/cancelled);
   the UI groups related statuses into a shorter, workflow-focused list. */
type RequestFilterKey = "all" | "active" | "draft" | "under_review" | "approved" | "in_progress" | "partially_fulfilled" | "fulfilled" | "rejected" | "cancelled";

const REQUEST_FILTER_GROUPS: Record<Exclude<RequestFilterKey, "all">, SupplyRequestStatus[]> = {
  /* "active" is the dashboard's Requests-In-Progress tile. It has no chip of its
     own — it is a deep-link target so that tile and the list it opens can never
     disagree on what "in progress" means. */
  active: ["submitted", "under_review", "approved", "processing", "fulfillment_in_progress"],
  draft: ["draft"],
  under_review: ["submitted", "under_review"],
  approved: ["approved"],
  in_progress: ["processing", "fulfillment_in_progress"],
  partially_fulfilled: ["partially_fulfilled"],
  fulfilled: ["fulfilled"],
  rejected: ["rejected"],
  cancelled: ["cancelled"],
};

const REQUEST_PRIMARY_FILTERS: { key: Exclude<RequestFilterKey, "all">; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "partially_fulfilled", label: "Partially Fulfilled" },
  { key: "fulfilled", label: "Fulfilled" },
];

const REQUEST_MORE_FILTERS: { key: Exclude<RequestFilterKey, "all">; label: string }[] = [
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

/* Label for every filter key, including "active" which has no chip but is
   reachable by deep link from the dashboard tile. */
const REQUEST_FILTER_LABEL: Record<RequestFilterKey, string> = {
  all: "All",
  active: "In Progress",
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  in_progress: "In Progress",
  partially_fulfilled: "Partially Fulfilled",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const RequestSupply = ({ data, actions, goTo, preset, onPresetConsumed }: {
  data: VendorData; actions: VendorActions; goTo: (p: Page) => void;
  preset?: RequestFilterKey | null; onPresetConsumed?: () => void;
}) => {
  const [filter, setFilter] = React.useState<RequestFilterKey>(preset ?? "all");
  const [presetLocal, setPresetLocal] = React.useState<RequestFilterKey | null>(preset ?? null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SupplyRequest | null>(null);
  const [viewing, setViewing] = React.useState<SupplyRequest | null>(null);

  const clearPreset = () => { setPresetLocal(null); onPresetConsumed?.(); };

  const applyFilter = (next: RequestFilterKey) => {
    setFilter(next);
    setPresetLocal(next === "all" ? null : next);
    onPresetConsumed?.();
  };

  const filtered = data.supplyRequests.filter(r => {
    const matchF = filter === "all" || REQUEST_FILTER_GROUPS[filter].includes(r.status);
    const qq = q.toLowerCase();
    const matchQ = !qq || r.id.toLowerCase().includes(qq) || r.reason.toLowerCase().includes(qq) || r.items.some(i => i.productName.toLowerCase().includes(qq));
    return matchF && matchQ;
  }).sort((a, b) => +new Date(b.requestDate) - +new Date(a.requestDate));

  const filterCount = (key: RequestFilterKey) => {
    const counts = data.supplyRequestCounts ?? {};
    if (key === "all") {
      return Object.values(counts).reduce((a, b) => a + b, 0);
    }
    return REQUEST_FILTER_GROUPS[key].reduce((a, s) => a + (counts[s] ?? 0), 0);
  };

  const moreActive = filter === "rejected" || filter === "cancelled";

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${active ? "bg-[#5b21b6] text-white border-[#5b21b6]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`;

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inp} pl-9`} placeholder="Search request ref, reason, or product…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { applyFilter("all"); setMoreOpen(false); }} className={pill(filter === "all")}>All ({filterCount("all")})</button>
          {REQUEST_PRIMARY_FILTERS.map(f => (
            <button key={f.key} onClick={() => { applyFilter(f.key); setMoreOpen(false); }} className={pill(filter === f.key)}>{f.label} ({filterCount(f.key)})</button>
          ))}
          {/* A deep link from a dashboard tile stays visible as a removable chip
              so it is always obvious why the list is narrowed. */}
          {presetLocal && !REQUEST_PRIMARY_FILTERS.some(f => f.key === presetLocal) && (
            <button type="button" onClick={clearPreset} title="Show all requests" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1.5 hover:bg-violet-100 transition-colors cursor-pointer">
              {REQUEST_FILTER_LABEL[presetLocal]} from Dashboard <X size={12} />
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMoreOpen(o => !o)} aria-haspopup="menu" aria-expanded={moreOpen} className={`${pill(moreActive)} inline-flex items-center gap-1`}>More <ChevronDown size={13} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} /></button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                <div role="menu" className="absolute right-0 top-full mt-2 z-30 min-w-[170px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {REQUEST_MORE_FILTERS.map(f => (
                    <button key={f.key} role="menuitem" onClick={() => { applyFilter(f.key); setMoreOpen(false); }} className={`block w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${filter === f.key ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}>{f.label} ({filterCount(f.key)})</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <Btn className="shrink-0" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> Create Request</Btn>
      </Card>

      <Card>
        <div className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3">Request Reference</th>
                  <th className="text-left px-4 py-3">Requested</th>
                  <th className="text-left px-4 py-3">Items</th>
                  <th className="text-left px-4 py-3">Needed By</th>
                  <th className="text-left px-4 py-3">Priority</th>
                  <th className="text-left px-4 py-3">Fulfillment</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3"><MonoId id={r.id} />{r.submittedAt && <p className="text-[11px] text-slate-400 mt-0.5">Submitted {fmtDate(r.submittedAt)}</p>}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(r.requestDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[240px]"><p className="truncate">{r.items.map(i => i.productName).join(", ")}</p>{r.items.length > 1 && <p className="text-[11px] text-slate-400">{r.items.length} items</p>}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(r.neededByDate)}</td>
                    <td className="px-4 py-3"><PriorityPill priority={r.priority} /></td>
                    <td className="px-4 py-3"><FulfillmentTag progress={r.fulfillment.progress} /><p className="text-[11px] text-slate-400 mt-0.5">{r.fulfillment.items.reduce((a, f) => a + f.fulfilledQty, 0).toLocaleString()} / {r.fulfillment.items.reduce((a, f) => a + f.requestedQty, 0).toLocaleString()} {r.items[0]?.unit ?? ""}</p></td>
                    <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <button onClick={() => setViewing({ ...r })} className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-slate-600 hover:text-violet-700" title="View details"><Eye size={14} /></button>
                      {r.status === "draft" && <button onClick={() => { setEditing({ ...r }); setFormOpen(true); }} className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-slate-600 hover:text-violet-700" title="Edit draft"><Save size={14} /></button>}
                    </div></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-sm text-slate-400">No supply requests found. Click "Create Request" to request supplies.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 lg:hidden">
          {filtered.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div><MonoId id={r.id} /><p className="text-sm font-bold text-slate-800 mt-1">{fmtDate(r.requestDate)}</p></div>
                <RequestStatusBadge status={r.status} />
              </div>
              <div className="space-y-1 text-xs text-slate-600 mb-3">
                <div className="flex gap-2"><PackageOpen size={12} className="text-slate-400 mt-0.5" />{r.items.map(i => i.productName).join(", ")}</div>
                <div className="flex gap-2"><CalendarClock size={12} className="text-slate-400 mt-0.5" />Needed by {fmtDate(r.neededByDate)}</div>
                <div className="flex gap-2"><AlertTriangle size={12} className="text-slate-400 mt-0.5" /><PriorityPill priority={r.priority} /></div>
              </div>
              <Btn size="sm" variant="secondary" className="w-full" onClick={() => setViewing({ ...r })}><Eye size={12} /> View Details</Btn>
            </Card>
          ))}
          {filtered.length === 0 && <Card className="p-8 text-center col-span-full text-sm text-slate-400">No supply requests found.</Card>}
        </div>
      </Card>

      <RequestForm open={formOpen} onClose={() => { clearDraft("request", editing?.id ?? "new"); setFormOpen(false); }} editing={editing} data={data} actions={actions} />

      {viewing && (
        <RequestDetail
          request={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { const draft = viewing; setViewing(null); setEditing(draft); setFormOpen(true); }}
          actions={actions}
        />
      )}
    </div>
  );
};

/* ── form helpers ─────────────────────────────────────── */

const MAP_BACKEND_FIELDS: Record<string, string> = {
  supplier_reference: "docRef",
  supplier_id: "items",
  received_at: "receivedAt",
  received_by: "receivedBy",
  remarks: "remarks",
  items: "items",
};

const mapFieldErrors = (errors?: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors ?? {})) {
    const f = MAP_BACKEND_FIELDS[k];
    if (f && !out[f]) out[f] = v;
  }
  return out;
};

/* ── receiving (record) ────────────────────────────────── */

const Receiving = ({ data, actions, goTo, preset, onPresetConsumed }: {
  data: VendorData; actions: VendorActions; goTo: (p: Page) => void;
  preset?: ReceivingPreset | null; onPresetConsumed?: () => void;
}) => {
  const [presetLocal, setPresetLocal] = React.useState<ReceivingPreset | null>(preset ?? null);
  const presetStatus = presetLocal?.arrivalStatus ?? null;
  const [ackArrival, setAckArrival] = React.useState<SupplyArrival | null>(null);

  const clearPreset = () => { setPresetLocal(null); onPresetConsumed?.(); };

  const queueAll = data.arrivals
    .filter(a => a.status === "pending" || a.status === "partially_received")
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const queue = presetStatus && presetStatus !== "expected" ? queueAll.filter(a => a.status === presetStatus) : queueAll;

  const expectedOnly = presetStatus === "expected"
    ? data.arrivals.filter(a => a.status === "expected").sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    : null;

  const upcoming = presetStatus === "expected"
    ? []
    : data.arrivals.filter(a => a.status === "expected").sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)).slice(0, 3);

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Receiving Work Queue</h2>
          <p className="text-xs text-slate-400">Deliveries already inspected and accepted by the Receiving &amp; Checker, awaiting the Vendor&apos;s final receipt acknowledgment.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {presetLocal && (
            <button type="button" onClick={clearPreset} title="Show all" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1.5 hover:bg-violet-100 transition-colors cursor-pointer">
              {RECEIVE_PRESET_LABEL[presetLocal.arrivalStatus]} only <X size={12} />
            </button>
          )}
          <Btn size="sm" variant="secondary" onClick={() => goTo("monitor")}><PackageSearch size={14} /> Expected Deliveries</Btn>
        </div>
      </Card>

      {expectedOnly ? (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Clock size={15} className="text-sky-600" /><h3 className="text-sm font-bold text-slate-800">Expected Deliveries</h3></div>
          <div className="space-y-2">
            {expectedOnly.map(a => (
              <div key={a.id} className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 min-w-0"><MonoId id={a.id} /><span className="truncate text-slate-600">{a.supplierName} · {a.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</span></div>
                <div className="flex items-center gap-2 shrink-0"><span className="text-slate-400">{fmtDate(a.expectedDate)} {a.expectedTime}</span><SupplyBadge status={a.status} /></div>
              </div>
            ))}
            {expectedOnly.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No expected deliveries.</p>}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
        {queue.length === 0 && (
          <Card className="p-10 text-center">
            <PackageOpen size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Nothing pending receiving.</p>
            <p className="text-xs text-slate-400 mt-1">Accepted supplies will appear here once the Receiving &amp; Checker completes its inspection.</p>
          </Card>
        )}

        {queue.map(a => {
          const bad = arrivalHasIssue(a.id, data.receipts);
          const ackAvail = (a.acceptedQty ?? 0) > (a.receivedQty ?? 0);
          return (
            <Card key={a.id} className="p-5 flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <MonoId id={a.id} />
                    <span className="text-sm font-bold text-slate-800">{a.supplierName}</span>
                    <SupplyBadge status={a.status} />
                  </div>
                  <div className="max-w-md">
                    <ProgressBar received={a.receivedQty ?? 0} total={a.requiredQty ?? a.totalQty} bad={bad} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {`Checker accepted ${(a.acceptedQty ?? 0).toLocaleString()} · Vendor received ${(a.receivedQty ?? 0).toLocaleString()} · ${(a.remainingQty ?? 0).toLocaleString()} remaining`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {ackAvail && <Btn size="sm" onClick={() => setAckArrival(a)}><PackageCheck size={13} /> Record Received</Btn>}
                </div>
              </div>

              {a.items.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 grid gap-1.5">
                  {a.items.map(item => {
                    const accepted = item.acceptedQty ?? 0;
                    const damaged = item.damagedQty ?? 0;
                    const vendorReceived = item.vendorReceived ?? 0;
                    const remaining = item.remainingQty ?? Math.max(0, (item.qty ?? 0) - vendorReceived);
                    return (
                      <div key={item.productName} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                        <span className="font-semibold text-slate-600">{item.productName}</span>
                        <span className="flex items-center gap-2.5 text-slate-500">
                          <span className="inline-flex items-center gap-1"><span className="text-slate-300">Required</span><b className="text-slate-700">{item.qty.toLocaleString()}</b></span>
                          <span className="inline-flex items-center gap-1"><span className="text-slate-300">Accepted</span><b className="text-green-700">{accepted.toLocaleString()}</b></span>
                          <span className="inline-flex items-center gap-1"><span className="text-slate-300">Received</span><b className="text-sky-700">{vendorReceived.toLocaleString()}</b></span>
                          <span className="inline-flex items-center gap-1"><span className="text-slate-300">Remaining</span><b className="text-amber-600">{remaining.toLocaleString()}</b></span>
                          {damaged > 0 && <span className="inline-flex items-center gap-1"><span className="text-slate-300">Damaged</span><b className="text-red-600">{damaged.toLocaleString()}</b></span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        </div>
      )}

      {upcoming.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Clock size={15} className="text-sky-600" /><h3 className="text-sm font-bold text-slate-800">Upcoming Expected Supplies</h3></div>
          <div className="space-y-2">
            {upcoming.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0"><MonoId id={a.id} /><span className="truncate text-slate-600">{a.supplierName} · {a.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</span></div>
                <div className="flex items-center gap-2 shrink-0"><span className="text-slate-400">{fmtDate(a.expectedDate)}</span><SupplyBadge status={a.status} /></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {ackArrival && (
        <RecordReceivedModal
          arrival={ackArrival} data={data} actions={actions}
          onClose={() => setAckArrival(null)}
        />
      )}
    </div>
  );
};

const RecordReceivedModal = ({ arrival, data, actions, onClose }: {
  arrival: SupplyArrival; data: VendorData; actions: VendorActions; onClose: () => void;
}) => {
  const [phase, setPhase] = React.useState<"confirm" | "working" | "success">("confirm");
  const [remarks, setRemarks] = React.useState("");
  const [lines, setLines] = React.useState<Record<string, number>>({});
  const [err, setErr] = React.useState("");
  const [documents, setDocuments] = React.useState<SupplyDeliveryDocument[]>([]);
  const [docErr, setDocErr] = React.useState("");
  const [now, setNow] = React.useState(() => new Date());
  const [receivingId] = React.useState<string>(() => genId("VRC"));
  const viewUrlRef = React.useRef<string>("");

  React.useEffect(() => {
    const init: Record<string, number> = {};
    for (const it of arrival.items) {
      const available = Math.max(0, it.availableQty ?? 0);
      init[`${it.productName}::${it.unit}`] = available;
    }
    setLines(init);
  }, [arrival.id]);

  /* Preview of the current time only — the authoritative Receiving timestamp
     is generated by the backend when Confirmation is submitted. */
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const docs = await actions.listArrivalDocuments(arrival.id);
        if (alive) setDocuments(docs);
      } catch {
        if (alive) setDocErr("The linked document list is currently unavailable.");
      }
    })();
    return () => { alive = false; };
  }, [arrival.id, actions]);

  const busy = phase !== "confirm";
  const requestClose = () => { if (!busy) onClose(); };

  /* Received By is the authenticated Vendor account — read-only. */
  const sessionUser = getSessionUser();
  const receivedBy = sessionUser?.displayName?.trim() ?? sessionUser?.username?.trim() ?? "";

  const setLine = (key: string, value: string) => {
    setLines(prev => ({ ...prev, [key]: Number(value) }));
  };

  const itemsToSend = () => arrival.items
    .map(it => ({ productName: it.productName, unit: it.unit, qty: Number(lines[`${it.productName}::${it.unit}`] ?? 0) }))
    .filter(i => i.qty > 0);

  const isEmpty = (arrival.acceptedQty ?? 0) <= 0;
  const requiredTotal = arrival.requiredQty ?? arrival.totalQty ?? 0;
  const fullyReceived = (arrival.receivedQty ?? 0) >= requiredTotal - 1e-9;
  const receiveableItems = arrival.items.filter(it => (it.acceptedQty ?? 0) > 0);

  const receivingTotal = itemsToSend().reduce((a, i) => a + Number(i.qty), 0);

  const latestReceiving = [...data.vendorReceivings].filter(v => v.arrivalId === arrival.id)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0] ?? null;

  const handleViewDoc = async (doc: SupplyDeliveryDocument) => {
    try {
      const blob = await actions.fetchArrivalFile(arrival.id, doc.id);
      if (viewUrlRef.current) URL.revokeObjectURL(viewUrlRef.current);
      viewUrlRef.current = URL.createObjectURL(blob);
      window.open(viewUrlRef.current, "_blank", "noopener");
    } catch {
      setDocErr("Could not open the linked document. Try again later.");
    }
  };

  const handleConfirm = async () => {
    setErr("");
    if (!receivedBy) {
      setErr("Your account has no display name to record as the receiver. Ask an administrator to set it first.");
      return;
    }
    const items = itemsToSend();
    if (items.length === 0) { setErr("Enter a positive Received Quantity for at least one product."); return; }
    for (const i of items) {
      const item = arrival.items.find(t => t.productName === i.productName && t.unit === i.unit);
      const available = Math.max(0, item?.availableQty ?? 0);
      if (i.qty > available) {
        setErr(`Received Quantity (${i.qty.toLocaleString()}) exceeds the remaining accepted stock (${available.toLocaleString()}) for "${i.productName}".`);
        return;
      }
    }
    setPhase("working");
    const res = await actions.confirmVendorReceiving(arrival.id, {
      id: receivingId,
      items,
      receivedAt: now.toISOString(),
      receivingBy: receivedBy,
      remarks: remarks.trim(),
    });
    if (res.ok) setPhase("success");
    else { setPhase("confirm"); setErr(res.error ?? "Could not record the received stock. Try again."); }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-[#5b21b6] mb-2">{children}</div>
  );

  const InfoRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-slate-800 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );

  const fmtSize = (b: number) =>
    b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`;

  if (phase === "success") {
    return (
      <Modal open onClose={onClose} title="Receiving Recorded" maxW="max-w-md"
        footer={<div className="flex justify-end"><Btn size="sm" onClick={onClose}>Done</Btn></div>}>
        <div className="flex gap-3 items-start">
          <span className="shrink-0 rounded-full bg-green-100 text-green-600 p-2"><CheckCircle2 size={18} /></span>
          <div className="min-w-0">
            <p className="text-sm text-slate-600 leading-relaxed"><strong className="text-slate-800"><MonoId id={arrival.id} /></strong> — received as <span className="font-mono font-semibold text-green-700">{receivingId}</span> · Received By <strong className="text-slate-800">{receivedBy}</strong>.</p>
            {fullyReceived
              ? <p className="text-xs text-slate-400 mt-1">All required stock is now received. The delivery is <strong className="text-slate-600">Completed</strong> and read-only.</p>
              : <p className="text-xs text-slate-400 mt-1">Partial acknowledgment recorded ({receivingTotal.toLocaleString()} received now). The delivery remains <strong className="text-slate-600">Partially Received</strong> — {(arrival.receivedQty ?? 0).toLocaleString()} of {requiredTotal.toLocaleString()} required units acknowledged.</p>}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={requestClose} title={`Record Received · ${arrival.id}`} maxW="max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Btn variant="secondary" size="sm" onClick={requestClose} disabled={busy}>Cancel</Btn>
          {!isEmpty && !fullyReceived && (
            <Btn size="sm" onClick={() => void handleConfirm()} disabled={busy}>
              {phase === "working" ? <RefreshCw size={13} className="animate-spin" /> : <PackageCheck size={13} />}
              {phase === "working" ? "Confirming…" : "Confirm Receipt"}
            </Btn>
          )}
        </div>
      }>
      <p className="text-sm text-slate-600 mb-4">
        Confirm the stock the Vendor acknowledges receiving today. The accepted quantities have already been fixed by the Receiving/Checker subsystem.
      </p>

      {/* Delivery Information */}
      <div className="rounded-xl border border-slate-200 p-3.5 mb-4">
        <SectionTitle><Truck size={13} />Delivery Information</SectionTitle>
        <InfoRow label="Supply Chain Reference" value={<MonoId id={arrival.sourceRef} />} mono />
        <InfoRow label="Delivery ID" value={<MonoId id={arrival.id} />} mono />
        <InfoRow label="Supplier" value={arrival.supplierName} />
        <InfoRow label="Delivery Date" value={`${fmtDate(arrival.expectedDate)} · ${arrival.expectedTime}`} />
        {arrival.destination && <InfoRow label="Destination" value={arrival.destination} />}
      </div>

      {isEmpty ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
          <div className="flex gap-2"><AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">No accepted stock is available to receive yet.</p>
              <p className="text-amber-700">This delivery has no quantity passed forward by the Receiving/Checker. Accepted quantities appear here once the checker transaction is recorded.</p>
            </div>
          </div>
        </div>
      ) : fullyReceived ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-xs text-green-800">
          <div className="flex gap-2"><CheckCircle2 size={15} className="shrink-0 mt-0.5 text-green-600" />
            <div>
              <p className="font-semibold text-green-900 mb-1">This delivery is fully received and read-only.</p>
              <p className="text-green-700">
                {requiredTotal.toLocaleString()} required units have been acknowledged by the Vendor
                {latestReceiving ? <> · Received By <strong>{latestReceiving.receivedBy}</strong> on {fmtDateTime(latestReceiving.receivedAt)}</> : null}.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Item & Quantity */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3.5 pt-3.5"><SectionTitle><PackageCheck size={13} />Item Information</SectionTitle></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="text-left font-bold px-3.5 py-2">Product</th>
                  <th className="text-right font-bold px-2 py-2">Original</th>
                  <th className="text-right font-bold px-2 py-2">Accepted</th>
                  <th className="text-right font-bold px-2 py-2">Available</th>
                  <th className="text-right font-bold px-3.5 py-2">Received Qty</th>
                </tr>
              </thead>
              <tbody>
                {receiveableItems.map(it => {
                  const available = Math.max(0, it.availableQty ?? 0);
                  const accepted = it.acceptedQty ?? 0;
                  const damaged = it.damagedQty ?? 0;
                  const received = it.vendorReceived ?? 0;
                  const key = `${it.productName}::${it.unit}`;
                  return (
                    <tr key={key} className="border-t border-slate-100">
                      <td className="px-3.5 py-2.5 align-top">
                        <p className="font-semibold text-slate-700 leading-tight">{it.productName}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {Number(it.qty ?? 0).toLocaleString()} required · {accepted.toLocaleString()} accepted · {received.toLocaleString()} already received · {(Math.max(0, Number(it.qty ?? 0) - received)).toLocaleString()} remaining
                          {damaged > 0 && <span className="text-red-500"> · {damaged.toLocaleString()} damaged</span>}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-500 whitespace-nowrap">{Number(it.qty ?? 0).toLocaleString()}</td>
                      <td className="px-2 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">{accepted.toLocaleString()}</td>
                      <td className="px-2 py-2.5 text-right font-semibold text-[#5b21b6] whitespace-nowrap">{available.toLocaleString()}</td>
                      <td className="px-3.5 py-2.5">
                        {available > 0 ? (
                          <input
                            type="number" min={0} max={available} step="any"
                            value={lines[key] ?? ""}
                            onChange={e => setLine(key, e.target.value)}
                            disabled={busy}
                            className={`${inp} min-h-0 py-1.5 text-sm text-right w-28 ml-auto`}
                          />
                        ) : <span className="text-xs text-slate-400 block text-right">Fully received</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Receiving Information */}
          <div className="rounded-xl border border-slate-200 p-3.5">
            <SectionTitle><PackageCheck size={13} />Receiving Information</SectionTitle>
            <InfoRow label="Current Receiving Status" value={supplyStatusCfg(arrival.status)?.label ?? arrival.status} />
            <InfoRow label="Received By" value={<span className="inline-flex items-center gap-1.5"><Users size={13} className="text-slate-400" />{receivedBy || <span className="text-amber-600">No display name set on this account</span>}</span>} />
            <InfoRow label="Received Date & Time" value={
              <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />{fmtDateTime(now.toISOString())} <span className="text-[10px] font-normal text-slate-400">(server timestamp on confirm)</span></span>
            } />
            <InfoRow label="Received Quantity" value={<span className="font-bold text-slate-900">{receivingTotal.toLocaleString()}</span>} />
            <div className="pt-2">
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Receiving Remarks <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea className={`${inp} resize-none`} rows={2} maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)} disabled={busy} placeholder="Receiving notes — e.g. Received and acknowledged in good condition." />
            </div>
          </div>

          {/* Linked Documents */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3.5 pt-3.5"><SectionTitle><FileText size={13} />Linked Documents</SectionTitle></div>
            {documents.length === 0 ? (
              <p className="px-3.5 pb-3.5 text-xs text-slate-400">{docErr || "No linked delivery documents for this supply chain transaction."}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {documents.map(d => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{d.name}</p>
                      <p className="text-[11px] text-slate-400">{fmtDateTime(d.uploadedAt)} · {fmtSize(d.sizeBytes)}</p>
                    </div>
                    <Btn variant="ghost" size="sm" onClick={() => void handleViewDoc(d)} disabled={busy}><Eye size={13} /> View</Btn>
                  </li>
                ))}
              </ul>
            )}
            <p className="px-3.5 pb-3 text-[11px] text-slate-400">Existing delivery documents are shown for reference only.</p>
          </div>
        </div>
      )}

      {err && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0 mt-0.5" />{err}</div>}
    </Modal>
  );
};

/* ── supply monitoring ─────────────────────────────────── */

const SupplyMonitoring = ({ data, actions, goTo }: {
  data: VendorData; actions: VendorActions; goTo: (p: Page) => void;
}) => {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | SupplyStatus>("all");
  const [receivingAck, setReceivingAck] = React.useState<SupplyArrival | null>(null);

  const ACTIVE_CLS: Record<SupplyStatus, string> = {
    expected: "bg-sky-500",
    pending: "bg-amber-500",
    partially_received: "bg-orange-500",
    completed: "bg-green-600",
  };

  const statuses: SupplyStatus[] = ["expected", "pending", "partially_received", "completed"];

  const filtered = data.arrivals.filter(a => {
    const matchF = filter === "all" || a.status === filter;
    const qq = q.toLowerCase();
    const matchQ = !qq || a.id.toLowerCase().includes(qq) || a.supplierName.toLowerCase().includes(qq) || a.items.some(i => i.productName.toLowerCase().includes(qq)) || a.sourceRef.toLowerCase().includes(qq);
    return matchF && matchQ;
  }).sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const availability = data.receipts
    .filter(r => r.items.some(i => i.condition === "good"))
    .flatMap(r => r.items.filter(i => i.condition === "good").map(i => ({ supplier: r.supplierName, product: i.productName, qty: i.qty, unit: i.unit })));

  const avSummary = Object.values(availability.reduce<Record<string, { supplier: string; product: string; qty: number; unit: string }>>((acc, i) => {
    const key = `${i.supplier}|${i.product}|${i.unit}`;
    acc[key] = acc[key] ? { ...acc[key], qty: acc[key].qty + i.qty } : { ...i };
    return acc;
  }, {})).sort((a, b) => a.product.localeCompare(b.product));

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search supply ref, supplier, or product…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${filter === "all" ? "bg-[#5b21b6] text-white border-[#5b21b6]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>All ({data.arrivals.length})</button>
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${filter === s ? `${ACTIVE_CLS[s]} text-white border-transparent` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>{SUPPLY_STATUS_CFG[s].label} ({data.arrivals.filter(a => a.status === s).length})</button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(a => {
          const bad = arrivalHasIssue(a.id, data.receipts);
          return (
            <Card key={a.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{a.supplierName}</p><MonoId id={a.id} /></div>
                <SupplyBadge status={a.status} />
              </div>
              <div className="space-y-1 text-xs text-slate-500 mb-3">
                {a.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="truncate">{i.productName}</span>
                    <span className="font-semibold text-slate-700 shrink-0">{i.qty.toLocaleString()} {i.unit}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1"><span>Expected</span><span>{fmtDate(a.expectedDate)} {a.expectedTime}</span></div>
                <div className="flex justify-between"><span>Destination</span><span className="truncate">{a.destination}</span></div>
                {a.sourceRef && <div className="flex justify-between"><span>Delivery Schedule</span><span className="font-mono text-[11px] text-slate-400">{a.sourceRef}</span></div>}
              </div>
              <ProgressBar received={(a.receivedQty ?? 0)} total={a.requiredQty ?? a.totalQty} bad={bad} />
              {(a.requiredQty ?? a.totalQty) > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Checker accepted {(a.acceptedQty ?? 0).toLocaleString()} · vendor received {(a.receivedQty ?? 0).toLocaleString()} · {(a.remainingQty ?? 0).toLocaleString()} remaining
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 flex-wrap">
                {((a.acceptedQty ?? 0) > (a.receivedQty ?? 0)) && <Btn size="sm" className="flex-1" onClick={() => setReceivingAck(a)}><PackageCheck size={13} /> Record Received</Btn>}
                {a.status === "completed" && <Btn size="sm" variant="secondary" className="flex-1" onClick={() => goTo("history")}><PackageCheck size={13} /> View Receiving History</Btn>}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-10 text-center col-span-full text-sm text-slate-400">No supplies match this view.</Card>}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><Boxes size={16} className="text-green-600" /><h3 className="text-sm font-bold text-slate-800">Supply Availability — Received Quantities</h3></div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-4 py-2">Product / Supply</th><th className="text-left px-4 py-2">Supplier</th><th className="text-right px-4 py-2">Qty Received</th><th className="text-left px-4 py-2">Unit</th>
            </tr></thead>
            <tbody>
              {avSummary.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{r.product}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{r.supplier}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-800">{r.qty.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.unit}</td>
                </tr>
              ))}
              {avSummary.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-sm text-slate-400">No good-condition receipts recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {avSummary.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{r.product}</p>
                <p className="text-xs text-slate-400 truncate">{r.supplier}</p>
              </div>
              <div className="text-right shrink-0"><p className="text-sm font-bold text-slate-800 whitespace-nowrap">{r.qty.toLocaleString()} {r.unit}</p><p className="text-[11px] text-slate-400">received</p></div>
            </div>
          ))}
          {avSummary.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No good-condition receipts recorded yet.</p>}
        </div>
      </Card>
{receivingAck && (
        <RecordReceivedModal
          arrival={receivingAck} data={data} actions={actions}
          onClose={() => setReceivingAck(null)}
        />
      )}
    </div>
  );
};

const Suppliers = ({ data, actions }: { data: VendorData; actions: VendorActions }) => {
  const [q, setQ] = React.useState("");
  const [viewing, setViewing] = React.useState<Supplier | null>(null);

  const filtered = data.suppliers.filter(s => {
    const qq = q.toLowerCase();
    return !qq || s.id.toLowerCase().includes(qq) || s.companyName.toLowerCase().includes(qq) || s.sourceRef.toLowerCase().includes(qq) || s.contactName.toLowerCase().includes(qq);
  });

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inp} pl-9`} placeholder="Search supplier ID, company, or contact…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </Card>

      <div className="hidden xl:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Source Ref</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Products Provided</th>
                  <th className="text-left px-4 py-3">Established</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{s.companyName}</p><MonoId id={s.id} /></td>
                    <td className="px-4 py-3"><MonoId id={s.sourceRef} /></td>
                    <td className="px-4 py-3"><p className="text-sm text-slate-700">{s.contactName}</p><p className="text-xs text-slate-400">{s.supplierType}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[240px]"><p className="truncate">{s.products.map(p => `${p.name} (${p.sku})`).join(", ") || "—"}</p><p className="text-[11px] text-slate-400 mt-0.5">{[...new Set(s.products.filter(p => p.category).map(p => p.category))].join(", ")}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(s.establishedOn)}</td>
                    <td className="px-4 py-3"><SupStatusPill status={s.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><Btn size="sm" variant="secondary" onClick={() => setViewing({ ...s })}><Eye size={12} /> View</Btn></div></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">No supplier records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:hidden">
        {filtered.map(s => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div><p className="text-sm font-bold text-slate-800">{s.companyName}</p><MonoId id={s.id} /></div>
              <SupStatusPill status={s.status} />
            </div>
            <div className="space-y-1 text-xs text-slate-600 mb-3">
              <div className="flex gap-2"><Users size={12} className="text-slate-400 mt-0.5" />{s.contactName} · {s.supplierType}</div>
              <div className="flex gap-2"><Mail size={12} className="text-slate-400 mt-0.5" />{s.contactEmail}</div>
              <div className="flex gap-2"><PackageOpen size={12} className="text-slate-400 mt-0.5" />{s.products.map(p => `${p.name}${p.sku ? ` (${p.sku})` : ""}`).join(", ") || "—"}</div>
              <div className="flex gap-2"><Info size={12} className="text-slate-400 mt-0.5" />Source Ref <MonoId id={s.sourceRef} /></div>
            </div>
            <Btn size="sm" variant="secondary" className="w-full" onClick={() => setViewing({ ...s })}><Eye size={12} /> View Supplier</Btn>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-8 text-center col-span-full text-sm text-slate-400">No supplier records yet.</Card>}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Supplier · ${viewing.companyName}` : "Supplier"} maxW="max-w-[680px]"
        footer={viewing && <div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => setViewing(null)}>Close</Btn><Btn size="sm" onClick={() => { actions.toggleSupplierActive(viewing.id); setViewing({ ...viewing, status: viewing.status === "active" ? "inactive" : "active" }); }}>{viewing.status === "active" ? <><XCircle size={13} /> Mark Inactive</> : <><CheckCircle size={13} /> Mark Active</>}</Btn></div>}>
        {viewing && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex gap-2 text-xs text-sky-700"><Info size={14} className="shrink-0 mt-0.5" /> Status toggles are for operational monitoring only.</div>
            <div className="flex items-center justify-between flex-wrap gap-2"><MonoId id={viewing.id} /><SupStatusPill status={viewing.status} /></div>
            {[
              { k: "Company Name", v: viewing.companyName, i: <Building2 size={14} /> },
              { k: "Supplier Type", v: viewing.supplierType, i: <Users size={14} /> },
              { k: "Contact Person", v: viewing.contactName, i: <Users size={14} /> },
              { k: "Contact", v: `${viewing.contactEmail} · ${viewing.contactPhone}`, i: <Mail size={14} /> },
              { k: "Address", v: viewing.address, i: <MapPin size={14} /> },
              { k: "Company", v: `${viewing.email} · ${viewing.phone}${viewing.website ? ` · ${viewing.website}` : ""}`, i: <Phone size={14} /> },
              { k: "Distribution Area", v: viewing.distributionArea || "—", i: <MapPin size={14} /> },
              { k: "Established On", v: fmtDate(viewing.establishedOn), i: <Clock size={14} /> },
            ].map(r => (
              <div key={r.k} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
                <div className="text-slate-400 mt-0.5">{r.i}</div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-1">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{r.k}</p>
                  <p className="text-sm text-slate-700 break-words">{r.v}</p>
                </div>
              </div>
            ))}
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">Products / Supplies Provided</p>
              <div className="space-y-2">
                {viewing.products.map(p => (
                   <div key={p.id} className="border border-slate-200 rounded-xl p-3">
                     <div className="flex items-center justify-between mb-1">
                       <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                       <span className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{p.sku}{p.unit ? ` · ${p.unit}` : ""}</span>
                     </div>
                     <p className="text-xs text-slate-500">{p.description || "—"} <span className="text-slate-400">· {p.brand}</span> {p.stock ? `· Stock: <strong>${p.stock}</strong>` : ""}</p>
                     {p.category && <span className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{p.category}</span>}
                   </div>
                 ))}
                {viewing.products.length === 0 && <p className="text-xs text-slate-400">No product records provided yet.</p>}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
              <span>Receipts on file: <strong className="text-slate-800">{data.receipts.filter(r => r.supplierId === viewing.id).length}</strong></span>
              <span>Total received: <strong className="text-slate-800">{supplierReceivedQty(viewing.id, data.receipts).toLocaleString()} units</strong></span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ── receiving history ─────────────────────────────────── */

const ReceivingHistory = ({ data, actions, preset, onPresetConsumed }: {
  data: VendorData; actions: VendorActions; preset?: HistoryPreset | null; onPresetConsumed?: () => void;
}) => {
  const [presetLocal, setPresetLocal] = React.useState<HistoryPreset | null>(preset ?? null);
  const [q, setQ] = React.useState("");
  const [viewing, setViewing] = React.useState<SupplyReceipt | null>(null);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [range, setRange] = React.useState<{ from?: string; to?: string } | null>(null);
  const [rangeError, setRangeError] = React.useState("");
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [filteredRows, setFilteredRows] = React.useState<SupplyReceipt[] | null>(null);
  const [sortDir, setSortDir] = React.useState<"new" | "old">("new");
  const [reportOpen, setReportOpen] = React.useState(false);
  const [pdfView, setPdfView] = React.useState<{ pdfBase64: string; filename: string } | null>(null);

  const openReport = () => {
    const f = from.trim();
    const t = to.trim();
    if (f && t && f > t) {
      setRangeError("Invalid date range. The From date cannot be later than the To date.");
      return;
    }
    setReportOpen(true);
  };

  const presetFetched = React.useRef(false);

  React.useEffect(() => {
    if (!preset || presetFetched.current) return;
    presetFetched.current = true;
    onPresetConsumed?.();
    const f = preset.from ?? "";
    const t = preset.to ?? "";
    if (!f && !t) return;
    setFrom(f);
    setTo(t);
    setRangeLoading(true);
    void (async () => {
      const res = await actions.searchVendorReceivingHistory(f || undefined, t || undefined);
      setRangeLoading(false);
      if (res.ok) {
        setFilteredRows(res.rows);
        setRange({ from: f || undefined, to: t || undefined });
      } else {
        setRangeError(res.error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = async () => {
    const f = from.trim();
    const t = to.trim();
    if (f && t && f > t) {
      setRangeError("Invalid date range. The From date cannot be later than the To date.");
      return;
    }
    setRangeError("");
    setRangeLoading(true);
    const res = await actions.searchVendorReceivingHistory(f || undefined, t || undefined);
    setRangeLoading(false);
    if (res.ok) {
      setFilteredRows(res.rows);
      setRange(f || t ? { from: f || undefined, to: t || undefined } : null);
    } else {
      setRangeError(res.error);
    }
  };

  const clearFilter = () => {
    setFrom("");
    setTo("");
    setRange(null);
    setRangeError("");
    setFilteredRows(null);
    setPresetLocal(null);
  };

  const editFrom = (v: string) => { setFrom(v); setFilteredRows(null); setRange(null); setRangeError(""); };
  const editTo = (v: string) => { setTo(v); setFilteredRows(null); setRange(null); setRangeError(""); };

  const base = (filteredRows ?? data.vendorReceivingHistory).filter(r =>
    presetLocal?.arrivalStatus
      ? data.arrivals.find(a => a.id === r.arrivalId)?.status === presetLocal.arrivalStatus
      : true
  );
  const filtered = [...base]
    .filter(r => {
      const qq = q.toLowerCase();
      const matchQ = !qq || r.id.toLowerCase().includes(qq) || r.supplierName.toLowerCase().includes(qq) || r.docRef.toLowerCase().includes(qq) || r.receivingBy.toLowerCase().includes(qq) || r.items.some(i => i.productName.toLowerCase().includes(qq));
      return matchQ;
    })
    .sort((a, b) =>
      sortDir === "new"
        ? +new Date(b.receivedAt) - +new Date(a.receivedAt)
        : +new Date(a.receivedAt) - +new Date(b.receivedAt)
    );

  const emptyMessage = range
    ? "No receiving records found for the selected date range."
    : presetLocal?.arrivalStatus
      ? `No ${SUPPLY_STATUS_CFG[presetLocal.arrivalStatus].label} receiving records found.`
      : "No receiving transactions found.";

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search ref no., supplier, product, received by, doc ref…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSortDir(d => d === "new" ? "old" : "new")} className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${sortDir === "new" ? "bg-white text-slate-500 border-slate-200 hover:border-slate-300" : "bg-violet-50 text-violet-700 border-violet-200"}`}><ArrowDownUp size={13} className="inline -mt-0.5 mr-1" /> {sortDir === "new" ? "Newest First" : "Oldest First"}</button>
          </div>
        </div>
        <div className="mt-3 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
              From Date
              <input type="date" className={`${inp} min-h-[40px] py-2 text-sm`} value={from} max={to || undefined} onChange={e => editFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
              To Date
              <input type="date" className={`${inp} min-h-[40px] py-2 text-sm`} value={to} min={from || undefined} onChange={e => editTo(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Btn size="sm" onClick={applyFilter} disabled={rangeLoading}><Search size={13} /> {rangeLoading ? "Filtering…" : "Apply Filter"}</Btn>
            <Btn size="sm" variant="secondary" onClick={clearFilter} disabled={rangeLoading}>Clear Filter</Btn>
            <Btn size="sm" variant="secondary" onClick={openReport} disabled={rangeLoading}><FileDown size={13} /> PDF Auto Reports</Btn>
          </div>
          {presetLocal?.arrivalStatus && (
            <button type="button" onClick={clearFilter} title="Clear filter" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1.5 hover:bg-violet-100 transition-colors cursor-pointer">
              {SUPPLY_STATUS_CFG[presetLocal.arrivalStatus].label} records only <X size={11} />
            </button>
          )}
          {rangeError && <p className="text-xs font-semibold text-red-600 xl:ml-2">{rangeError}</p>}
        </div>
      </Card>

      <Card>
        <div className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3">Receiving Ref No.</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3">Quantity</th>
                  <th className="text-left px-4 py-3">Date Received</th>
                  <th className="text-left px-4 py-3">Received By</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3"><MonoId id={r.id} />{r.docRef !== "—" && <p className="text-[11px] text-slate-400 mt-0.5">Doc {r.docRef}</p>}</td>
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-700">{r.supplierName}</p>{r.arrivalId && <MonoId id={r.arrivalId} />}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]"><p className="truncate">{r.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</p></td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">{r.totalQty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(r.receivedAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.receivingBy}</td>
                    <td className="px-4 py-3"><ReceiptStatusPill /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><button onClick={() => setViewing({ ...r })} className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-slate-600 hover:text-violet-700" title="View details"><Eye size={14} /></button></div></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-sm text-slate-400">{emptyMessage}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 lg:hidden">
          {filtered.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0"><MonoId id={r.id} /><p className="text-sm font-bold text-slate-800 mt-1 truncate">{r.supplierName}</p></div>
                <ReceiptStatusPill />
              </div>
              <div className="space-y-1 text-xs text-slate-600 mb-3">
                <div className="flex gap-2"><PackageOpen size={12} className="text-slate-400 mt-0.5" />{r.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</div>
                <div className="flex gap-2"><Clock size={12} className="text-slate-400 mt-0.5" />{fmtDateTime(r.receivedAt)}</div>
                <div className="flex gap-2"><Users size={12} className="text-slate-400 mt-0.5" />{r.receivingBy}</div>
              </div>
              <Btn size="sm" variant="secondary" className="w-full" onClick={() => setViewing({ ...r })}><Eye size={12} /> View Details</Btn>
            </Card>
          ))}
          {filtered.length === 0 && <Card className="p-8 text-center col-span-full text-sm text-slate-400">{emptyMessage}</Card>}
        </div>
      </Card>

      <ReceiptDetailsModal rec={viewing} onClose={() => setViewing(null)} />
      <ReportPasswordModal open={reportOpen} onClose={() => setReportOpen(false)} from={from} to={to} onPdfGenerated={(b, fn) => setPdfView({ pdfBase64: b, filename: fn })} />
      <PdfViewerModal data={pdfView} onClose={() => setPdfView(null)} />
    </div>
  );
};

/* ── notifications (bell popover) ──────────────────────── */

const fmtNotifTime = (ts: string) => {
  const d = +new Date(ts);
  if (Number.isNaN(d)) return fmtDate(ts);
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(ts);
};

const NotifPopover = ({ open, bellRef, onClose, data, actions }: {
  open: boolean;
  bellRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  data: VendorData;
  actions: VendorActions;
}) => {
  const [pos, setPos] = React.useState<{ top: number; right: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const hasOpened = React.useRef(false);

  const measure = React.useCallback(() => {
    const r = bellRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 12;
    const width = Math.min(384, window.innerWidth - margin * 2);
    const right = Math.max(margin, Math.min(window.innerWidth - width - margin, window.innerWidth - r.right - margin));
    setPos({ top: r.bottom + 8, right });
  }, [bellRef]);

  /* Keep a measured position even while closed so the exit animation renders */
  React.useLayoutEffect(() => { measure(); }, [measure]);

  /* Re-measure on resize/scroll while the panel is visible */
  React.useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  React.useEffect(() => { if (open) hasOpened.current = true; }, [open]);

  /* Click outside the panel and bell closes it */
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (bellRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onClose, bellRef]);

  /* Escape closes it */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const animCls = open
    ? "notif-in"
    : hasOpened.current
      ? "notif-out pointer-events-none"
      : "pointer-events-none opacity-0";

  const notifIcon: Record<AppNotification["type"], { icon: React.ReactNode; cls: string }> = {
    info: { icon: <Info size={15} />, cls: "bg-sky-50 text-sky-600" },
    success: { icon: <CheckCircle2 size={15} />, cls: "bg-green-50 text-green-600" },
    warning: { icon: <AlertTriangle size={15} />, cls: "bg-orange-50 text-orange-600" },
    error: { icon: <AlertCircle size={15} />, cls: "bg-red-50 text-red-600" },
  };
  const unread = data.notifications.filter(n => !n.read).length;

  return createPortal(
    <>
      {pos && (
        <div ref={panelRef} role="menu" aria-hidden={!open} className={`fixed z-50 w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden ${animCls}`} style={{ top: pos.top, right: pos.right }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60 min-h-[52px]">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unread > 0 && <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-bold">{unread}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => actions.markAllNotifsRead()} className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 px-2 py-1.5 rounded-lg hover:bg-violet-50" disabled={data.notifications.every(n => n.read)}>Mark all read</button>
              <button onClick={() => actions.clearNotifications()} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50" title="Clear all" disabled={data.notifications.length === 0}><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto divide-y divide-slate-100">
            {data.notifications.map(n => {
              const meta = notifIcon[n.type];
              return (
                <button key={n.id} onClick={() => actions.markNotifRead(n.id)} title={n.read ? "Notification read" : "Mark as read"} className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${n.read ? "hover:bg-slate-50/60" : "bg-violet-50/40 hover:bg-violet-50/70"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm ${n.read ? "font-medium text-slate-700" : "font-bold text-slate-800"}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{fmtNotifTime(n.timestamp)}</p>
                  </div>
                </button>
              );
            })}
            {data.notifications.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Bell size={22} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-500">No notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.getElementById("modal-portal") ?? document.body
  );
};
