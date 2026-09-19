import * as React from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, PackagePlus, PackageSearch, PackageCheck, Building2, Building, Bell,
  LogOut, Menu, X, Eye, Search, ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Trash2,
  Clock, Truck, Boxes, ClipboardList, AlertTriangle, AlertCircle, Info, RefreshCw, Lock,
  CheckCircle2, CheckCircle, XCircle, PackageOpen, Users, Mail, Phone, MapPin, FileText, ArrowLeft,
} from "lucide-react";
import {
  Supplier, SupplyReceipt, ReceiptItem, ReceiptCondition, SupplyStatus, AppNotification,
  UNIT_OPTIONS, SUPPLY_STATUS_CFG, CONDITION_LABEL,
  genId, fmtDate, fmtDateTime, arrivalReceivedQty, arrivalHasIssue, receiptHasIssue,
  supplierReceivedQty, VendorData, VendorActions,
} from "./vendor-data";

/* ─────────────────────────────────────────────────────────
   TRI-M GLOBAL LOGISTICS & TRADING INC. — VENDOR MANAGEMENT
   Receiving & monitoring subsystem. Consumes supplier and
   supply information passed downstream by the Supply Chain
   subsystem. No supplier recruiting / sourcing happens here.
   ───────────────────────────────────────────────────────── */

type Page = "dashboard" | "receiving" | "monitor" | "suppliers" | "history" | "notifications" | "company";

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

const SupplyBadge = ({ status }: { status: SupplyStatus }) => {
  const c = SUPPLY_STATUS_CFG[status];
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

const ReceiptStatusPill = ({ rec }: { rec: SupplyReceipt }) =>
  receiptHasIssue(rec)
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-red-50 text-red-700 border-red-200"><AlertTriangle size={12} /> Rejected / Damaged</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-green-50 text-green-700 border-green-200"><CheckCircle2 size={12} /> Received</span>;

const KpiCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color: string }) => (
  <Card className="p-5 card-hover">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
    </div>
  </Card>
);

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

/* ── sign in ───────────────────────────────────────────── */

export const VendorLogin = ({ onLogin }: { onLogin: () => void }) => {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin123") {
      setLoading(true);
      setTimeout(() => { onLogin(); setLoading(false); }, 400);
    } else {
      setError("Invalid username or password. Try the demo credentials below.");
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
          <p className="text-xs text-slate-500 mb-6">Record and monitor supplies provided through the Supply Chain subsystem.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Username">
              <input className={inp} value={username} onChange={e => { setUsername(e.target.value); setError(""); }} placeholder="admin" autoComplete="username" />
            </Field>
            <Field label="Password">
              <input type="password" className={inp} value={password} onChange={e => { setPassword(e.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0" />{error}</div>}
            <Btn type="submit" className="w-full" disabled={loading || !username || !password}>
              {loading ? <><RefreshCw size={15} className="animate-spin" /> Signing in…</> : <><Lock size={15} /> Sign In</>}
            </Btn>
          </form>
          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Demo credentials</p>
            <p className="text-xs text-slate-600 font-mono">Username: <strong>admin</strong> · Password: <strong>admin123</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── shell ─────────────────────────────────────────────── */

const NAV: { icon: React.ReactNode; label: string; page: Page }[] = [
  { icon: <LayoutDashboard size={17} />, label: "Dashboard", page: "dashboard" },
  { icon: <PackagePlus size={17} />, label: "Receiving", page: "receiving" },
  { icon: <PackageSearch size={17} />, label: "Supply Monitoring", page: "monitor" },
  { icon: <Building2 size={17} />, label: "Suppliers", page: "suppliers" },
  { icon: <ClipboardList size={17} />, label: "Receiving History", page: "history" },
  { icon: <Bell size={17} />, label: "Notifications", page: "notifications" },
  { icon: <Building size={17} />, label: "Company Profile", page: "company" },
];

type Props = {
  data: VendorData;
  actions: VendorActions;
  onLogout: () => void;
};

export default function VendorManagement(props: Props) {
  const { data, actions, onLogout } = props;
  const [page, setPage] = React.useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [receiptTarget, setReceiptTarget] = React.useState<string | null>(null);

  const unread = data.notifications.filter(n => !n.read).length;
  const currentLabel = NAV.find(n => n.page === page)?.label ?? "Dashboard";
  const toNext = (p: Page) => { setPage(p); window.scrollTo({ top: 0 }); };

  const startReceiving = (arrivalId?: string) => {
    if (arrivalId) setReceiptTarget(arrivalId);
    setPage("receiving");
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
          {NAV.map(({ icon, label, page: p }) => (
            <button key={p} onClick={() => { setPage(p); setMobileOpen(false); }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${isCollapsed ? "justify-center" : ""} ${page === p ? "bg-violet-500/20 text-white" : "text-slate-300 hover:text-white hover:bg-white/5"}`}>
              {icon}
              {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
              {!isCollapsed && p === "notifications" && unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>}
              {isCollapsed && <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">{label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 pt-2 pb-4 mt-auto space-y-1">
          <button onClick={onLogout} className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-red-400 hover:bg-red-500/10 ${isCollapsed ? "justify-center" : ""}`}>
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
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Authorized Staff</span>
            <button onClick={() => toNext("notifications")} className="relative p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors" title="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div key={page} className="page-enter mx-auto max-w-[1440px]">
            {page === "dashboard" && <Dashboard data={data} goTo={toNext} startReceiving={startReceiving} />}
            {page === "receiving" && <Receiving data={data} actions={actions} target={receiptTarget} onTargetConsumed={() => setReceiptTarget(null)} goTo={toNext} />}
            {page === "monitor" && <SupplyMonitoring data={data} actions={actions} startReceiving={startReceiving} goTo={toNext} />}
            {page === "suppliers" && <Suppliers data={data} actions={actions} />}
            {page === "history" && <ReceivingHistory data={data} />}
            {page === "notifications" && <Notifications data={data} actions={actions} />}
            {page === "company" && <CompanyProfile />}
          </div>
        </main>
        <div id="modal-portal" />
      </div>
    </div>
  );
}

/* ── dashboard ─────────────────────────────────────────── */

const Dashboard = ({ data, goTo, startReceiving }: { data: VendorData; goTo: (p: Page) => void; startReceiving: (id?: string) => void }) => {
  const { arrivals, receipts, suppliers } = data;
  const count = (s: SupplyStatus) => arrivals.filter(a => a.status === s).length;
  const expected = count("expected");
  const forReceiving = count("for_receiving");
  const partial = count("partially_received");
  const received = count("received");
  const completed = count("completed");
  const rejected = count("rejected_damaged");

  const recentReceipts = [...receipts].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt)).slice(0, 5);
  const recentNotifs = data.notifications.slice(0, 4);
  const upcoming = arrivals.filter(a => a.status === "expected" || a.status === "for_receiving")
    .sort((a, b) => +a.expectedDate - +b.expectedDate).slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#5b21b6] text-white flex items-center justify-center"><Boxes size={24} /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Vendor Management Overview</h1>
            <p className="text-xs text-slate-400">Receive, record, and monitor supplies provided through the Supply Chain subsystem.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn size="sm" onClick={() => startReceiving()}><PackagePlus size={14} /> Record Receiving</Btn>
          <Btn size="sm" variant="secondary" onClick={() => goTo("monitor")}><PackageSearch size={14} /> Supply Monitoring</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={<Clock size={18} className="text-sky-600" />} label="Expected Deliveries" value={expected} sub={expected > 0 ? "Awaiting arrival" : "No upcoming"} color="bg-sky-50" />
        <KpiCard icon={<Truck size={18} className="text-amber-600" />} label="For Receiving" value={forReceiving} sub="At facility, pending receive" color="bg-amber-50" />
        <KpiCard icon={<Boxes size={18} className="text-green-600" />} label="Supplies Received" value={receipts.length} sub="Total receiving transactions" color="bg-green-50" />
        <KpiCard icon={<RefreshCw size={18} className="text-orange-600" />} label="Partially Received" value={partial} sub="Balance pending" color="bg-orange-50" />
        <KpiCard icon={<PackageCheck size={18} className="text-indigo-600" />} label="Completed Receiving" value={completed} sub="Closed & forwarded" color="bg-indigo-50" />
        <KpiCard icon={<AlertTriangle size={18} className="text-red-600" />} label="Issues / Damaged" value={rejected} sub={rejected > 0 ? "Needs attention" : "No issues"} color="bg-red-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="p-5 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><ClipboardList size={16} /></div>
              <h3 className="text-sm font-bold text-slate-800">Recent Supply Receipts</h3>
            </div>
            <button onClick={() => goTo("history")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-2">
            {recentReceipts.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 truncate"><MonoId id={r.id} /><span className="truncate">{r.supplierName}</span></p>
                  <p className="text-xs text-slate-400 truncate">{r.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0"><ReceiptStatusPill rec={r} /><span className="text-[11px] text-slate-400">{fmtDateTime(r.receivedAt)}</span></div>
              </div>
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
            <button onClick={() => goTo("notifications")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-2">
            {recentNotifs.map(n => (
              <div key={n.id} className={`p-3 rounded-xl border ${n.read ? "border-slate-100" : "border-violet-200 bg-violet-50/40"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{n.title}</span>
                  <span className="text-[11px] text-slate-400">{fmtDate(n.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">{n.message}</p>
              </div>
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
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 truncate"><MonoId id={a.id} /><span className="truncate">{a.supplierName}</span></p>
                  <p className="text-xs text-slate-400 truncate">{a.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0"><SupplyBadge status={a.status} /><span className="text-[11px] text-slate-400">{fmtDate(a.expectedDate)} · {a.destination}</span></div>
              </div>
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
            {suppliers.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No supplier records. Supply Chain data expected.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ── receiving form helpers ────────────────────────────── */

const localNowValue = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(+d)) return localNowValue();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyItem = (): ReceiptItem => ({ productName: "", qty: 1, unit: "pcs", condition: "good" });

const ReceiptForm = ({ data, actions, open, editing, targetArrivalId, onClose, onSaved }: {
  data: VendorData; actions: VendorActions; open: boolean;
  editing: SupplyReceipt | null; targetArrivalId: string | null;
  onClose: () => void; onSaved: () => void;
}) => {
  const [arrivalId, setArrivalId] = React.useState<string>("");
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [items, setItems] = React.useState<ReceiptItem[]>([emptyItem()]);
  const [receivedAt, setReceivedAt] = React.useState(localNowValue());
  const [receivingBy, setReceivingBy] = React.useState("R. Dela Cruz");
  const [docRef, setDocRef] = React.useState<string>("");
  const [remarks, setRemarks] = React.useState("");
  const [err, setErr] = React.useState("");

  const reset = () => {
    setArrivalId(""); setSupplierId(""); setItems([emptyItem()]); setReceivedAt(localNowValue());
    setReceivingBy("R. Dela Cruz"); setDocRef(""); setRemarks(""); setErr("");
  };

  const applyArrival = (id: string) => {
    const arr = data.arrivals.find(a => a.id === id);
    setArrivalId(id);
    setSupplierId(arr?.supplierId ?? "");
    if (arr) {
      setItems(arr.items.map(i => ({ productName: i.productName, qty: i.qty, unit: i.unit, condition: "good" as ReceiptCondition })));
    } else {
      setItems([emptyItem()]);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      const e = editing;
      setArrivalId(e.arrivalId); setSupplierId(e.supplierId);
      setItems(e.items.map(i => ({ ...i })));
      setReceivedAt(toLocalInput(e.receivedAt)); setReceivingBy(e.receivingBy); setDocRef(e.docRef); setRemarks(e.remarks); setErr("");
    } else if (targetArrivalId) {
      applyArrival(targetArrivalId);
      setReceivedAt(localNowValue()); setReceivingBy("R. Dela Cruz"); setDocRef(""); setRemarks(""); setErr("");
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, targetArrivalId]);

  const arrival = data.arrivals.find(a => a.id === arrivalId) ?? null;
  const supplier = data.suppliers.find(s => s.id === supplierId) ?? null;
  const totalQty = items.reduce((a, i) => a + (Number(i.qty) || 0), 0);

  const handleSave = () => {
    setErr("");
    if (!supplierId) { setErr("Choose a supplier or link an expected supply first."); return; }
    if (items.length === 0 || items.some(i => !i.productName.trim() || (Number(i.qty) || 0) <= 0)) { setErr("Add at least one product line with a valid quantity."); return; }
    const rec: SupplyReceipt = {
      id: editing?.id ?? genId("RR"),
      arrivalId: arrival ? arrival.id : "",
      supplierId,
      supplierName: supplier?.companyName ?? supplierId,
      items: items.map(i => ({ ...i, qty: Number(i.qty) || 0 })),
      totalQty,
      receivedAt: new Date(receivedAt).toISOString(),
      receivingBy: receivingBy.trim() || "—",
      docRef: docRef.trim() || "—",
      remarks: remarks.trim(),
    };
    actions.recordReceipt(rec);
    reset();
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit Receiving Transaction · ${editing.id}` : "Record Supply Received"} maxW="max-w-[760px]"
      footer={
        <div className="flex flex-col gap-3">
          {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertCircle size={14} className="shrink-0" />{err}</div>}
          <div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn><Btn size="sm" onClick={handleSave}><Save size={14} /> {editing ? "Save Changes" : "Record Receiving"}</Btn></div>
        </div>
      }>
      <div className="space-y-5">
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2 text-xs text-violet-700"><Info size={14} className="shrink-0 mt-0.5" /> This module records physical receipt of supplies coordinated by the Supply Chain subsystem. No supplier sourcing decisions are made here.</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Expected Supply (optional)" hint="Link to the SC delivery schedule being fulfilled">
            <div className="relative">
              <select className={selectCls} value={arrivalId} onChange={e => { const v = e.target.value; if (v) applyArrival(v); else { setArrivalId(""); } }}>
                <option value="">— Ad-hoc receiving —</option>
                {data.arrivals.filter(a => a.status !== "completed").map(a => <option key={a.id} value={a.id}>{a.id} · {a.supplierName}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
          <Field label="Supplier Reference" required>
            <div className="relative">
              <select className={selectCls} value={supplierId} onChange={e => setSupplierId(e.target.value)} disabled={!!arrival}>
                <option value="">— Choose supplier —</option>
                {data.suppliers.filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.companyName} · {s.id}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
        </div>

        {arrival && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>SC schedule: <MonoId id={arrival.sourceRef} /></span>
            <span>Expected: {fmtDate(arrival.expectedDate)} {arrival.expectedTime}</span>
            <span>Destination: {arrival.destination}</span>
            <span>Status: <SupplyBadge status={arrival.status} /></span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Received Items — Quantity / Unit / Condition</p>
            <button onClick={() => setItems([...items, emptyItem()])} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1"><Plus size={12} /> Add item</button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[2fr_0.6fr_0.7fr_auto_auto] gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                <input className={inp} value={it.productName} onChange={e => setItems(prev => prev.map((x, j) => j === idx ? { ...x, productName: e.target.value } : x))} placeholder="Product / supply name" />
                <input type="number" min={1} className={inp} value={it.qty} onChange={e => setItems(prev => prev.map((x, j) => j === idx ? { ...x, qty: Number(e.target.value) } : x))} placeholder="Qty" />
                <div className="relative">
                  <select className={selectCls} value={it.unit} onChange={e => setItems(prev => prev.map((x, j) => j === idx ? { ...x, unit: e.target.value } : x))}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select className={selectCls} value={it.condition} onChange={e => setItems(prev => prev.map((x, j) => j === idx ? { ...x, condition: e.target.value as ReceiptCondition } : x))}>
                    {(Object.keys(CONDITION_LABEL) as ReceiptCondition[]).map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3 text-sm"><span className="text-slate-500">Total Quantity: <strong className="text-slate-800">{totalQty}</strong></span></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Received Date & Time" required><input type="datetime-local" className={inp} value={receivedAt} onChange={e => setReceivedAt(e.target.value)} /></Field>
          <Field label="Received By" required><input className={inp} value={receivingBy} onChange={e => setReceivingBy(e.target.value)} placeholder="Receiving personnel" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Document / Reference No." hint="Delivery receipt, waybill, invoice…"><input className={inp} value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="e.g. DR-2026-1234" /></Field>
          <Field label="Remarks"><input className={inp} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Condition, notes, follow-ups…" /></Field>
        </div>
      </div>
    </Modal>
  );
};

/* ── receiving (record) ────────────────────────────────── */

const Receiving = ({ data, actions, target, onTargetConsumed, goTo }: {
  data: VendorData; actions: VendorActions;
  target: string | null; onTargetConsumed: () => void; goTo: (p: Page) => void;
}) => {
  const [formOpen, setFormOpen] = React.useState(false);
  const [formTarget, setFormTarget] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<SupplyReceipt | null>(null);

  React.useEffect(() => {
    if (target) {
      setFormTarget(target);
      setEditing(null);
      setFormOpen(true);
      onTargetConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const openForm = (arrivalId?: string) => { setEditing(null); setFormTarget(arrivalId ?? null); setFormOpen(true); };

  const queue = data.arrivals
    .filter(a => a.status === "for_receiving" || a.status === "partially_received" || a.status === "received")
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const upcoming = data.arrivals.filter(a => a.status === "expected").sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)).slice(0, 3);

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Receiving Work Queue</h2>
          <p className="text-xs text-slate-400">Supplies at the facility, partially received, or awaiting final confirmation.</p>
        </div>
        <Btn size="sm" onClick={() => openForm()}><PackagePlus size={14} /> Record Receiving</Btn>
      </Card>

      <div className="space-y-3">
        {queue.length === 0 && (
          <Card className="p-10 text-center">
            <PackageOpen size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Nothing pending receiving.</p>
            <p className="text-xs text-slate-400 mt-1">Expected supplies will appear here once marked “For Receiving” in Supply Monitoring.</p>
          </Card>
        )}

        {queue.map(a => {
          const qty = arrivalReceivedQty(a.id, data.receipts);
          const bad = arrivalHasIssue(a.id, data.receipts);
          return (
            <Card key={a.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <MonoId id={a.id} />
                  <span className="text-sm font-bold text-slate-800">{a.supplierName}</span>
                  <SupplyBadge status={a.status} />
                </div>
                <p className="text-xs text-slate-500 mb-1">{a.items.map(i => `${i.productName} — ${i.qty.toLocaleString()} ${i.unit}`).join(" · ")}</p>
                <div className="max-w-md"><ProgressBar received={qty} total={a.totalQty} bad={bad} /></div>
                <p className="text-[11px] text-slate-400 mt-1">Expected {fmtDate(a.expectedDate)} {a.expectedTime} · {a.destination}</p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                {a.status === "for_receiving" && <Btn size="sm" onClick={() => openForm(a.id)}><PackagePlus size={13} /> Receive Supply</Btn>}
                {a.status === "partially_received" && <Btn size="sm" onClick={() => openForm(a.id)}><RefreshCw size={13} /> Record Balance</Btn>}
                {a.status === "received" && (
                  <>
                    <Btn size="sm" variant="secondary" onClick={() => goTo("history")}><Eye size={13} /> View Receipts</Btn>
                    <Btn size="sm" onClick={() => { if (confirm(`Complete receiving for ${a.supplierName} (${a.id}) and forward to inventory?`)) actions.updateArrivalStatus(a.id, "completed"); }}><PackageCheck size={13} /> Complete Receiving</Btn>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

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

      <ReceiptForm
        data={data} actions={actions} open={formOpen}
        editing={editing} targetArrivalId={formTarget}
        onClose={() => { setFormOpen(false); setEditing(null); setFormTarget(null); }}
        onSaved={() => { setFormOpen(false); setEditing(null); setFormTarget(null); }}
      />
    </div>
  );
};

/* ── supply monitoring ─────────────────────────────────── */

const SupplyMonitoring = ({ data, actions, startReceiving, goTo }: {
  data: VendorData; actions: VendorActions; startReceiving: (id?: string) => void; goTo: (p: Page) => void;
}) => {
  const [filter, setFilter] = React.useState<SupplyStatus | "all">("all");
  const [q, setQ] = React.useState("");

  const ACTIVE_CLS: Record<SupplyStatus, string> = {
    expected: "bg-sky-500",
    for_receiving: "bg-amber-500",
    received: "bg-indigo-500",
    partially_received: "bg-orange-500",
    completed: "bg-green-600",
    rejected_damaged: "bg-red-500",
  };

  const statuses: SupplyStatus[] = ["expected", "for_receiving", "partially_received", "received", "completed", "rejected_damaged"];

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
          const qty = arrivalReceivedQty(a.id, data.receipts);
          const bad = arrivalHasIssue(a.id, data.receipts);
          return (
            <Card key={a.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{a.supplierName}</p><MonoId id={a.id} /></div>
                <SupplyBadge status={a.status} />
              </div>
              <div className="space-y-1 text-xs text-slate-500 mb-3">
                {a.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-2"><span className="truncate">{i.productName}</span><span className="font-semibold text-slate-700 shrink-0">{i.qty.toLocaleString()} {i.unit}</span></div>
                ))}
                <div className="flex justify-between pt-1"><span>Expected</span><span>{fmtDate(a.expectedDate)} {a.expectedTime}</span></div>
                <div className="flex justify-between"><span>Destination</span><span className="truncate">{a.destination}</span></div>
                {a.sourceRef && <div className="flex justify-between"><span>SC Schedule</span><span className="font-mono text-[11px] text-slate-400">{a.sourceRef}</span></div>}
              </div>
              <ProgressBar received={qty} total={a.totalQty} bad={bad} />
              {a.remarks && <p className="text-[11px] text-slate-400 mt-2 italic truncate">{a.remarks}</p>}
              <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 flex-wrap">
                {a.status === "expected" && <Btn size="sm" className="flex-1" onClick={() => { if (confirm(`Mark ${a.id} as available for receiving?`)) actions.updateArrivalStatus(a.id, "for_receiving"); }}><Truck size={13} /> Mark For Receiving</Btn>}
                {a.status === "for_receiving" && <Btn size="sm" className="flex-1" onClick={() => startReceiving(a.id)}><PackagePlus size={13} /> Receive Now</Btn>}
                {a.status === "partially_received" && <Btn size="sm" className="flex-1" onClick={() => startReceiving(a.id)}><RefreshCw size={13} /> Record Balance</Btn>}
                {a.status === "received" && (
                  <>
                    <Btn size="sm" variant="secondary" className="flex-1" onClick={() => goTo("history")}><Eye size={13} /> Receipts</Btn>
                    <Btn size="sm" className="flex-1" onClick={() => { if (confirm(`Complete receiving for ${a.id} and forward to inventory?`)) actions.updateArrivalStatus(a.id, "completed"); }}><PackageCheck size={13} /> Complete</Btn>
                  </>
                )}
                {a.status === "completed" && <p className="text-xs text-slate-400 py-2">Closed — forwarded to inventory.</p>}
                {a.status === "rejected_damaged" && (
                  <>
                    <p className="text-[11px] text-red-500 py-1 italic">Supply had issues — awaiting SC resolution / replacement.</p>
                    <Btn size="sm" variant="secondary" className="flex-1" onClick={() => { if (confirm(`Reopen ${a.id} for receiving (e.g. replacement delivery)?`)) actions.updateArrivalStatus(a.id, "for_receiving"); }}><RefreshCw size={13} /> Reopen</Btn>
                  </>
                )}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-10 text-center col-span-full text-sm text-slate-400">No supplies match this view.</Card>}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><Boxes size={16} className="text-green-600" /><h3 className="text-sm font-bold text-slate-800">Supply Availability — Received Quantities</h3></div>
        <div className="overflow-x-auto">
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
      </Card>
    </div>
  );
};

/* ── suppliers (from Supply Chain) ──────────────────────── */

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
          <input className={`${inp} pl-9`} placeholder="Search supplier ID, company, SC source ref, contact…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="sm:w-72 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-[11px] text-sky-700 flex items-center gap-2"><Info size={13} className="shrink-0" />Supplier records are provided by the Supply Chain subsystem. Sourcing &amp; selection happen upstream.</div>
      </Card>

      <div className="hidden xl:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">SC Source Ref</th>
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
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[240px]"><p className="truncate">{s.products.map(p => p.name).join(", ") || "—"}</p><p className="text-[11px] text-slate-400 mt-0.5">{[...new Set(s.products.filter(p => p.category).map(p => p.category))].join(", ")}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(s.establishedOn)}</td>
                    <td className="px-4 py-3"><SupStatusPill status={s.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><Btn size="sm" variant="secondary" onClick={() => setViewing({ ...s })}><Eye size={12} /> View</Btn></div></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">No supplier records. Supplier data comes from the Supply Chain subsystem.</td></tr>}
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
              <div className="flex gap-2"><PackageOpen size={12} className="text-slate-400 mt-0.5" />{s.products.map(p => p.name).join(", ") || "—"}</div>
              <div className="flex gap-2"><Info size={12} className="text-slate-400 mt-0.5" />SC Ref <MonoId id={s.sourceRef} /></div>
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
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex gap-2 text-xs text-sky-700"><Info size={14} className="shrink-0 mt-0.5" /> Provided by the Supply Chain subsystem (source ref <MonoId id={viewing.sourceRef} />). Status toggles are for operational monitoring only.</div>
            <div className="flex items-center justify-between flex-wrap gap-2"><MonoId id={viewing.id} /><SupStatusPill status={viewing.status} /></div>
            {[
              { k: "Company Name", v: viewing.companyName, i: <Building2 size={14} /> },
              { k: "Supplier Type", v: viewing.supplierType, i: <Users size={14} /> },
              { k: "Contact Person", v: viewing.contactName, i: <Users size={14} /> },
              { k: "Contact", v: `${viewing.contactEmail} · ${viewing.contactPhone}`, i: <Mail size={14} /> },
              { k: "Address", v: viewing.address, i: <MapPin size={14} /> },
              { k: "Company", v: `${viewing.email} · ${viewing.phone}${viewing.website ? ` · ${viewing.website}` : ""}`, i: <Phone size={14} /> },
              { k: "Distribution Area", v: viewing.distributionArea || "—", i: <MapPin size={14} /> },
              { k: "Established (via SC)", v: fmtDate(viewing.establishedOn), i: <Clock size={14} /> },
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
                      {p.category && <span className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{p.category}</span>}
                    </div>
                    <p className="text-xs text-slate-500">{p.description || "—"} <span className="text-slate-400">· {p.brand}</span></p>
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

const ReceivingHistory = ({ data }: { data: VendorData }) => {
  const [q, setQ] = React.useState("");
  const [issOnly, setIssOnly] = React.useState(false);
  const [viewing, setViewing] = React.useState<SupplyReceipt | null>(null);

  const filtered = [...data.receipts]
    .filter(r => {
      const qq = q.toLowerCase();
      const matchQ = !qq || r.id.toLowerCase().includes(qq) || r.supplierName.toLowerCase().includes(qq) || r.docRef.toLowerCase().includes(qq) || r.receivingBy.toLowerCase().includes(qq) || r.items.some(i => i.productName.toLowerCase().includes(qq));
      const matchIss = !issOnly || receiptHasIssue(r);
      return matchQ && matchIss;
    })
    .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search ref no., supplier, product, received by, doc ref…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button onClick={() => setIssOnly(v => !v)} className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${issOnly ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}><AlertTriangle size={13} className="inline -mt-0.5 mr-1" /> Issues / Damaged only</button>
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
                    <td className="px-4 py-3"><ReceiptStatusPill rec={r} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><button onClick={() => setViewing({ ...r })} className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-slate-600 hover:text-violet-700" title="View details"><Eye size={14} /></button></div></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-sm text-slate-400">No receiving transactions found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 lg:hidden">
          {filtered.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div><MonoId id={r.id} /><p className="text-sm font-bold text-slate-800 mt-1">{r.supplierName}</p></div>
                <ReceiptStatusPill rec={r} />
              </div>
              <div className="space-y-1 text-xs text-slate-600 mb-3">
                <div className="flex gap-2"><PackageOpen size={12} className="text-slate-400 mt-0.5" />{r.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(", ")}</div>
                <div className="flex gap-2"><Clock size={12} className="text-slate-400 mt-0.5" />{fmtDateTime(r.receivedAt)}</div>
                <div className="flex gap-2"><Users size={12} className="text-slate-400 mt-0.5" />{r.receivingBy}</div>
              </div>
              <Btn size="sm" variant="secondary" className="w-full" onClick={() => setViewing({ ...r })}><Eye size={12} /> View Details</Btn>
            </Card>
          ))}
          {filtered.length === 0 && <Card className="p-8 text-center col-span-full text-sm text-slate-400">No receiving transactions found.</Card>}
        </div>
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Receiving Transaction · ${viewing.id}` : "Receiving"} maxW="max-w-[680px]"
        footer={viewing && <div className="flex justify-end"><Btn variant="secondary" size="sm" onClick={() => setViewing(null)}>Close</Btn></div>}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><MonoId id={viewing.id} /><ReceiptStatusPill rec={viewing} /></div>
            {[
              { k: "Supplier", v: `${viewing.supplierName}`, i: <Building2 size={14} /> },
              { k: "Expected Supply", v: viewing.arrivalId || "Ad-hoc (no linked SC schedule)", i: <PackageOpen size={14} /> },
              { k: "Date Received", v: fmtDateTime(viewing.receivedAt), i: <Clock size={14} /> },
              { k: "Received By", v: viewing.receivingBy, i: <Users size={14} /> },
              { k: "Document / Reference", v: viewing.docRef, i: <FileText size={14} /> },
              { k: "Remarks", v: viewing.remarks || "—", i: <Info size={14} /> },
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
                {viewing.items.map((it, i) => (
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
    </div>
  );
};

/* ── notifications ─────────────────────────────────────── */

const Notifications = ({ data, actions }: { data: VendorData; actions: VendorActions }) => {
  const notifIcon: Record<AppNotification["type"], { icon: React.ReactNode; cls: string }> = {
    info: { icon: <Info size={15} />, cls: "bg-sky-50 text-sky-600" },
    success: { icon: <CheckCircle2 size={15} />, cls: "bg-green-50 text-green-600" },
    warning: { icon: <AlertTriangle size={15} />, cls: "bg-orange-50 text-orange-600" },
    error: { icon: <AlertCircle size={15} />, cls: "bg-red-50 text-red-600" },
  };
  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <Btn size="sm" variant="secondary" onClick={() => actions.markAllNotifsRead()} disabled={data.notifications.every(n => n.read)}>Mark all read</Btn>
        <Btn size="sm" variant="ghost" onClick={() => actions.clearNotifications()} disabled={data.notifications.length === 0}><Trash2 size={13} /> Clear all</Btn>
      </div>
      <Card className="divide-y divide-slate-100">
        {data.notifications.map(n => {
          const meta = notifIcon[n.type];
          return (
            <button key={n.id} onClick={() => actions.markNotifRead(n.id)} className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${n.read ? "hover:bg-slate-50/60" : "bg-violet-50/40 hover:bg-violet-50/70"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${n.read ? "font-medium text-slate-700" : "font-bold text-slate-800"}`}>{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.timestamp)}</p>
              </div>
            </button>
          );
        })}
        {data.notifications.length === 0 && <div className="p-10 text-center text-sm text-slate-400">No notifications.</div>}
      </Card>
    </div>
  );
};

/* ── company profile ───────────────────────────────────── */

const CompanyProfile = () => {
  const steps = [
    { t: "Supply Chain Subsystem", d: "Finds & sources suppliers, coordinates and acquires supply.", c: "bg-sky-50 text-sky-700 border-sky-200" },
    { t: "Supplier & Supply Info", d: "Supplier records and supply schedules passed downstream.", c: "bg-violet-50 text-violet-700 border-violet-200" },
    { t: "Vendor Management Module", d: "Receives, records, and monitors the incoming supply.", c: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { t: "Receiving", d: "Records delivery details, quantity, condition, and personnel.", c: "bg-amber-50 text-amber-700 border-amber-200" },
    { t: "Supply Monitoring", d: "Tracks received, pending, and completed receiving transactions.", c: "bg-green-50 text-green-700 border-green-200" },
    { t: "Inventory / Stock Monitoring", d: "Forwarded received supply for stock monitoring downstream.", c: "bg-slate-100 text-slate-700 border-slate-200" },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        <div className="w-16 h-16 rounded-2xl bg-[#5b21b6] text-white flex items-center justify-center shrink-0"><Boxes size={30} /></div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800">Tri-M Global Logistics &amp; Trading Inc.</h1>
          <p className="text-xs text-slate-400 mt-0.5">Vendor Management Module — Supply receiving &amp; monitoring</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs text-slate-600">
            <div className="flex gap-2"><MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />Main Distribution Center (MDC), North Harbor, Manila</div>
            <div className="flex gap-2"><Mail size={12} className="text-slate-400 mt-0.5 shrink-0" />vendor@trimi-global.ph</div>
            <div className="flex gap-2"><Phone size={12} className="text-slate-400 mt-0.5 shrink-0" />+63 2 8888 0000</div>
            <div className="flex gap-2"><Building2 size={12} className="text-slate-400 mt-0.5 shrink-0" />Logistics &amp; Trading</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1"><PackageOpen size={16} className="text-violet-600" /><h3 className="text-sm font-bold text-slate-800">Downstream Integration — Supply Chain → Vendor Management</h3></div>
        <p className="text-xs text-slate-400 mb-4">This module consumes supplier and supply information passed downstream from the Supply Chain subsystem. Supplier sourcing, selection, and acquisition are performed upstream.</p>
        <div className="flex flex-col lg:flex-row items-stretch gap-3">
          {steps.map((s, i) => (
            <React.Fragment key={s.t}>
              {i > 0 && <div className="hidden lg:flex items-center"><ArrowLeft size={14} className="text-slate-300 -scale-x-100" /></div>}
              <div className={`flex-1 rounded-xl border p-3 ${s.c}`}>
                <p className="text-xs font-bold">{s.t}</p>
                <p className="text-[11px] mt-0.5 opacity-80">{s.d}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl flex gap-2 text-[11px] text-slate-500"><Info size={13} className="shrink-0 mt-0.5" />Mock data is structured to receive supplier and supply records from the Supply Chain subsystem through an API — no sourcing workflow exists inside this module.</div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4"><Users size={16} className="text-green-600" /><h3 className="text-sm font-bold text-slate-800">Receiving &amp; Monitoring Team</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { n: "R. Dela Cruz", r: "Receiving Coordinator" },
            { n: "K. Banag", r: "Warehouse Associate" },
            { n: "J. Mercado", r: "Quality Check" },
            { n: "Juan dela Cruz", r: "Module Administrator" },
          ].map(p => (
            <div key={p.n} className="rounded-xl border border-slate-200 p-3">
              <div className="w-8 h-8 rounded-full bg-[#5b21b6]/10 text-[#5b21b6] font-bold flex items-center justify-center text-xs mb-2">{p.n.split(" ").map(x => x[0]).join("")}</div>
              <p className="text-sm font-semibold text-slate-800">{p.n}</p>
              <p className="text-[11px] text-slate-400">{p.r}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};