import * as React from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Truck, Award,
  LogOut, Menu, X, Eye, CheckCircle2, Plus, Star, Phone, Mail, MapPin,
  Briefcase, FileText, AlertTriangle, Search, Info, ChevronDown, Bell, Clock, TrendingUp, Boxes,
  Filter, ChevronRight, ChevronLeft, ClipboardList, Users, Pencil, Save, Trash2, MoreVertical, ArrowUpRight,
  CircleCheck, Ban, PackageCheck, AlertCircle, ShieldCheck, Hash
} from "lucide-react";

// ─────────────────────────────────────────────────────────
//  TRI-M GLOBAL LOGISTICS & TRADING INC. — SUPPLIER / VENDOR MANAGEMENT MODULE
//  Flow: Supplier Action → Record Transaction → Purchased Products → Qty/Cost → Delivery Complete? → Stock / Issue
//        Supplier Action → View / Add / Update Supplier → Core2 DB
//        Evaluate Supplier → Retrieve Txns → Evaluate → Record → Core2 DB
// ─────────────────────────────────────────────────────────

type SupplierStatus = "Active" | "Inactive";
type DeliveryCheck = "pending" | "complete" | "issue";

interface SupplierProduct { id: string; name: string; category: string; }
interface Supplier {
  id: string; companyName: string; contactPerson: string; contactEmail: string; contactPhone: string;
  address: string; productsSupplied: SupplierProduct[]; status: SupplierStatus; createdAt: string;
}
interface TxnItem { productName: string; qty: number; unitCost: number; subtotal: number; }
interface SupplierTransaction {
  id: string; supplierId: string; supplierName: string; date: string; items: TxnItem[];
  totalQty: number; totalCost: number; notes: string; expectedDelivery: string; actualDelivery: string;
  deliveryCheck: DeliveryCheck; stockUpdated: boolean;
  issue?: { type: string; description: string };
}
interface Evaluation {
  id: string; supplierId: string; supplierName: string; date: string; period: string;
  deliveryScore: number; qualityScore: number; overallScore: number; remarks: string;
}

// ── utils
const now = () => new Date().toISOString();
const genId = (p: string) => `${p}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";
const fmtDT = (s: string) => s ? new Date(s).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── design tokens
const inp = "w-full min-h-[44px] px-3.5 py-2.5 text-[15px] sm:text-sm border border-slate-200 rounded-xl bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b21b6]/20 focus:border-[#5b21b6]/40 transition-colors";
const selectCls = `${inp} cursor-pointer appearance-none`;
const ISSUE_TYPES = ["Short Quantity", "Damaged Goods", "Wrong Item / Spec Mismatch", "Late Delivery", "Incomplete Documents", "Other"];
const PRODUCT_CATS = ["Dry Products", "Frozen Products", "Cosmetic Products", "Packaging", "General Merchandise"];

// ── shared UI
const Btn = ({ variant = "primary", size = "md", className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }) => {
  const v = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-ghost";
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
const Stars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5 items-center">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={12} className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"} />
    ))}
    <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>
  </div>
);
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
const StatusPill = ({ status }: { status: SupplierStatus }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${status === "Active" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === "Active" ? "bg-green-500" : "bg-slate-400"}`} />{status}
  </span>
);
const DeliveryPill = ({ dc }: { dc: DeliveryCheck }) => {
  const m: Record<DeliveryCheck, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: { label: "Pending Delivery", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={12} /> },
    complete: { label: "Complete & Correct", cls: "bg-green-50 text-green-700 border-green-200", icon: <CircleCheck size={12} /> },
    issue: { label: "Delivery Issue", cls: "bg-red-50 text-red-700 border-red-200", icon: <AlertTriangle size={12} /> },
  };
  const c = m[dc];
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${c.cls}`}>{c.icon}{c.label}</span>;
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

// ── seed data
const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "SUP-2024-10001", companyName: "BeautyPH Cosmetics Inc.", contactPerson: "Ana Reyes", contactEmail: "a.reyes@beautyphcosmetics.com", contactPhone: "+63 920 543 2109",
    address: "78 Shaw Blvd, Mandaluyong City, Metro Manila", status: "Active", createdAt: daysFromNow(-220),
    productsSupplied: [{ id: "sp1", name: "Korean BB Cream SPF 50+", category: "Cosmetic Products" }, { id: "sp2", name: "Hyaluronic Acid Serum 30ml", category: "Cosmetic Products" }, { id: "sp3", name: "Matte Lipstick Trio", category: "Cosmetic Products" }],
  },
  {
    id: "SUP-2024-10032", companyName: "Pacific Dry Goods Trading", contactPerson: "Marco Santos", contactEmail: "marco@pacificdry.ph", contactPhone: "+63 917 812 3456",
    address: "12 Harbor Drive, Port Area, Manila", status: "Active", createdAt: daysFromNow(-180),
    productsSupplied: [{ id: "sp4", name: "Premium Jasmine Rice 25kg", category: "Dry Products" }, { id: "sp5", name: "Canned Sardines 155g", category: "Dry Products" }],
  },
  {
    id: "SUP-2024-10048", companyName: "ColdChain Frozen Logistics", contactPerson: "Jen Lim", contactEmail: "jen.lim@coldchain.ph", contactPhone: "+63 928 765 4321",
    address: "Lot 8, Laguna Technopark, Biñan, Laguna", status: "Active", createdAt: daysFromNow(-140),
    productsSupplied: [{ id: "sp6", name: "Frozen Chicken Cut-ups 1kg", category: "Frozen Products" }, { id: "sp7", name: "Frozen Mixed Vegetables", category: "Frozen Products" }],
  },
  {
    id: "SUP-2023-09210", companyName: "Manila Packaging Solutions", contactPerson: "R. Dela Cruz", contactEmail: "r.delacruz@manilapack.ph", contactPhone: "+63 918 900 1122",
    address: "45 Industrial Ave, Quezon City", status: "Inactive", createdAt: daysFromNow(-410),
    productsSupplied: [{ id: "sp8", name: "Corrugated Box L", category: "Packaging" }],
  },
];

function seedTxns(): SupplierTransaction[] {
  return [
    { id: genId("TXN"), supplierId: SEED_SUPPLIERS[0].id, supplierName: SEED_SUPPLIERS[0].companyName, date: daysFromNow(-18), items: [{ productName: "Korean BB Cream SPF 50+", qty: 200, unitCost: 320, subtotal: 64000 }], totalQty: 200, totalCost: 64000, notes: "PO-TRM-2401", expectedDelivery: daysFromNow(-12).slice(0, 10), actualDelivery: daysFromNow(-12).slice(0, 10), deliveryCheck: "complete", stockUpdated: true },
    { id: genId("TXN"), supplierId: SEED_SUPPLIERS[1].id, supplierName: SEED_SUPPLIERS[1].companyName, date: daysFromNow(-14), items: [{ productName: "Premium Jasmine Rice 25kg", qty: 80, unitCost: 1850, subtotal: 148000 }], totalQty: 80, totalCost: 148000, notes: "PO-TRM-2405", expectedDelivery: daysFromNow(-8).slice(0, 10), actualDelivery: daysFromNow(-9).slice(0, 10), deliveryCheck: "complete", stockUpdated: true },
    { id: genId("TXN"), supplierId: SEED_SUPPLIERS[2].id, supplierName: SEED_SUPPLIERS[2].companyName, date: daysFromNow(-9), items: [{ productName: "Frozen Chicken Cut-ups 1kg", qty: 500, unitCost: 165, subtotal: 82500 }], totalQty: 500, totalCost: 82500, notes: "PO-TRM-2411", expectedDelivery: daysFromNow(-4).slice(0, 10), actualDelivery: daysFromNow(-4).slice(0, 10), deliveryCheck: "issue", stockUpdated: false, issue: { type: "Short Quantity", description: "Received 470/500 packs. 30 packs short. For follow-up." } },
    { id: genId("TXN"), supplierId: SEED_SUPPLIERS[0].id, supplierName: SEED_SUPPLIERS[0].companyName, date: daysFromNow(-5), items: [{ productName: "Matte Lipstick Trio", qty: 120, unitCost: 310, subtotal: 37200 }, { productName: "Hyaluronic Acid Serum 30ml", qty: 60, unitCost: 520, subtotal: 31200 }], totalQty: 180, totalCost: 68400, notes: "PO-TRM-2418", expectedDelivery: daysFromNow(2).slice(0, 10), actualDelivery: "", deliveryCheck: "pending", stockUpdated: false },
    { id: genId("TXN"), supplierId: SEED_SUPPLIERS[1].id, supplierName: SEED_SUPPLIERS[1].companyName, date: daysFromNow(-2), items: [{ productName: "Canned Sardines 155g", qty: 1000, unitCost: 18.5, subtotal: 18500 }], totalQty: 1000, totalCost: 18500, notes: "PO-TRM-2420", expectedDelivery: daysFromNow(5).slice(0, 10), actualDelivery: "", deliveryCheck: "pending", stockUpdated: false },
    { id: genId("TXN"), supplierId: SEED_SUPPLIERS[0].id, supplierName: SEED_SUPPLIERS[0].companyName, date: daysFromNow(-1), items: [{ productName: "Refreshing Facial Mist", qty: 140, unitCost: 185, subtotal: 25900 }], totalQty: 140, totalCost: 25900, notes: "PO-TRM-2422", expectedDelivery: daysFromNow(7).slice(0, 10), actualDelivery: "", deliveryCheck: "issue", stockUpdated: false, issue: { type: "Damaged Goods", description: "8 units with leakage/damaged seal upon arrival QC." } },
  ];
}
function seedEvals(): Evaluation[] {
  return [
    { id: genId("EV"), supplierId: SEED_SUPPLIERS[0].id, supplierName: SEED_SUPPLIERS[0].companyName, date: daysFromNow(-12), period: "Q1 2026", deliveryScore: 86, qualityScore: 92, overallScore: 89, remarks: "Consistent quality, minor late delivery in Feb." },
    { id: genId("EV"), supplierId: SEED_SUPPLIERS[1].id, supplierName: SEED_SUPPLIERS[1].companyName, date: daysFromNow(-20), period: "Q1 2026", deliveryScore: 91, qualityScore: 88, overallScore: 90, remarks: "Reliable dry goods supply. Good documentation." },
    { id: genId("EV"), supplierId: SEED_SUPPLIERS[2].id, supplierName: SEED_SUPPLIERS[2].companyName, date: daysFromNow(-8), period: "Feb 2026", deliveryScore: 68, qualityScore: 74, overallScore: 71, remarks: "Short quantity issue; needs corrective action." },
  ];
}

interface AppData { suppliers: Supplier[]; transactions: SupplierTransaction[]; evaluations: Evaluation[]; }
const STORAGE_KEY = "trim_vendor_module_v2";
function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch { /* ignore */ }
  const d: AppData = { suppliers: SEED_SUPPLIERS, transactions: seedTxns(), evaluations: seedEvals() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}
function useAppData() {
  const [data, setData] = React.useState<AppData>(() => loadData());
  const save = React.useCallback((next: AppData) => {
    setData(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  return [data, save] as const;
}

// ── login (staff / supplier shared — lightweight)
export const SupplierLogin = ({ onLogin }: { onLogin: (id: string) => void }) => {
  const [sid, setSid] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [err, setErr] = React.useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!sid.trim() || !email.trim()) { setErr("Enter Supplier ID and email to continue."); return; }
    const ok = SEED_SUPPLIERS.some(s => s.id.toLowerCase() === sid.trim().toLowerCase()) || sid.trim().length >= 3;
    if (!ok) { setErr("No supplier found. Use any Supplier ID above or enter at least 3 characters for staff access."); return; }
    onLogin(sid.trim() || "STAFF");
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2e1065] to-[#5b21b6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4"><Boxes size={28} className="text-violet-300" /></div>
          <h1 className="text-xl font-bold text-white">TRI-M Global Logistics & Trading Inc.</h1>
          <p className="text-sm text-violet-200 mt-1">Supplier / Vendor Management Module</p>
        </div>
        <div className="surface !rounded-2xl p-7 shadow-2xl bg-white">
          <h2 className="text-lg font-bold text-slate-800">Sign in</h2>
          <p className="text-xs text-slate-500 mb-6">Supplier or staff access for managing suppliers & transactions.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Supplier ID / Staff ID">
              <input className={inp} value={sid} onChange={e => { setSid(e.target.value); setErr(""); }} placeholder="e.g. SUP-2024-10001" />
            </Field>
            <Field label="Email">
              <input type="email" className={inp} value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="you@company.com" />
            </Field>
            {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertTriangle size={14} className="shrink-0" />{err}</div>}
            <Btn type="submit" className="w-full"><LogOut size={15} className="rotate-180" /> Enter Module</Btn>
          </form>
          <div className="mt-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-2">Quick demo</p>
            <div className="flex flex-wrap gap-1.5">
              {SEED_SUPPLIERS.slice(0, 2).map(s => (
                <button key={s.id} onClick={() => onLogin(s.id)} className="text-[11px] font-mono bg-white border border-slate-200 rounded-lg px-2 py-1 hover:border-violet-300 hover:text-violet-700">{s.id}</button>
              ))}
              <button onClick={() => onLogin("STAFF")} className="text-[11px] bg-violet-600 text-white rounded-lg px-2.5 py-1">Staff Access</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── DASHBOARD (KPIs relevant to Supplier Management flow)
const Dashboard = ({ data, onNav }: { data: AppData; onNav: (p: Page) => void }) => {
  const totalSuppliers = data.suppliers.length;
  const activeSuppliers = data.suppliers.filter(s => s.status === "Active").length;
  const totalTxns = data.transactions.length;
  const pending = data.transactions.filter(t => t.deliveryCheck === "pending").length;
  const issues = data.transactions.filter(t => t.deliveryCheck === "issue").length;
  const avgPerf = data.evaluations.length ? Math.round(data.evaluations.reduce((a, e) => a + e.overallScore, 0) / data.evaluations.length) : 0;

  const recentTxns = [...data.transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5);
  const recentIssues = [...data.transactions].filter(t => t.deliveryCheck === "issue").sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 4);
  const perfBySupplier = data.suppliers.map(s => {
    const evs = data.evaluations.filter(e => e.supplierId === s.id);
    const avg = evs.length ? Math.round(evs.reduce((a, e) => a + e.overallScore, 0) / evs.length) : 0;
    const txnCount = data.transactions.filter(t => t.supplierId === s.id).length;
    return { supplier: s, avg, txnCount, latest: evs[0] };
  }).sort((a, b) => b.avg - a.avg).slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#5b21b6] text-white flex items-center justify-center"><Building2 size={24} /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Supplier & Vendor Management</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => onNav("transactions")}><Plus size={14} /> Record Transaction</Btn>
          <Btn size="sm" variant="secondary" onClick={() => onNav("suppliers")}><Users size={14} /> Manage Suppliers</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={<Users size={18} className="text-violet-600" />} label="Total Suppliers" value={totalSuppliers} sub={`${activeSuppliers} active`} color="bg-violet-50" />
        <KpiCard icon={<CircleCheck size={18} className="text-green-600" />} label="Active Suppliers" value={activeSuppliers} sub="Ready to transact" color="bg-green-50" />
        <KpiCard icon={<ShoppingCart size={18} className="text-sky-600" />} label="Supplier Transactions" value={totalTxns} sub="All time" color="bg-sky-50" />
        <KpiCard icon={<Truck size={18} className="text-amber-600" />} label="Pending Deliveries" value={pending} sub="Awaiting delivery check" color="bg-amber-50" />
        <KpiCard icon={<AlertTriangle size={18} className="text-red-600" />} label="Delivery Issues" value={issues} sub="Needs attention" color="bg-red-50" />
        <KpiCard icon={<Award size={18} className="text-indigo-600" />} label="Avg Performance" value={avgPerf ? `${avgPerf}` : "—"} sub={avgPerf ? "Overall score" : "No evaluations"} color="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="p-5 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><HistoryIcon /></div><h3 className="text-sm font-bold text-slate-800">Recent Supplier Transactions</h3></div>
            <button onClick={() => onNav("transactions")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-2">
            {recentTxns.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-2"><MonoId id={t.id} /><span className="truncate">{t.supplierName}</span></p>
                  <p className="text-xs text-slate-400 truncate">{t.items.map(i => `${i.qty}× ${i.productName}`).join(" · ")} · {peso(t.totalCost)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0"><DeliveryPill dc={t.deliveryCheck} /><span className="text-[11px] text-slate-400">{fmtDate(t.date)}</span></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle size={16} /></div><h3 className="text-sm font-bold text-slate-800">Recent Delivery Issues</h3></div>
            <button onClick={() => onNav("issues")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-2">
            {recentIssues.map(t => (
              <div key={t.id} className="p-3 rounded-xl border border-red-100 bg-red-50/50">
                <div className="flex items-center justify-between mb-1"><MonoId id={t.id} /><span className="text-[11px] font-semibold text-red-700">{t.issue?.type}</span></div>
                <p className="text-xs font-medium text-slate-700 truncate">{t.supplierName}</p>
                <p className="text-xs text-slate-500 line-clamp-2">{t.issue?.description}</p>
                <p className="text-[11px] text-slate-400 mt-1">{fmtDate(t.date)} · {t.items[0]?.productName}</p>
              </div>
            ))}
            {recentIssues.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No delivery issues — all clear.</p>}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><TrendingUp size={16} /></div><h3 className="text-sm font-bold text-slate-800">Supplier Performance Overview</h3></div>
            <button onClick={() => onNav("performance")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">Evaluate <ChevronRight size={13} /></button>
          </div>
          {perfBySupplier.length === 0 ? <p className="text-sm text-slate-400">No performance data yet.</p> : (
            <div className="space-y-3">
              {perfBySupplier.map(({ supplier, avg, txnCount, latest }) => (
                <div key={supplier.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">{avg || "—"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{supplier.companyName} <span className="font-normal text-slate-400 text-xs">· {supplier.id}</span></p>
                    <p className="text-xs text-slate-400">{txnCount} transactions · {latest ? `${latest.period} · ${fmtDate(latest.date)}` : "Not yet evaluated"}</p>
                  </div>
                  <div className="hidden sm:block w-24 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#5b21b6]" style={{ width: `${avg}%` }} /></div>
                  <StatusPill status={supplier.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
};
const HistoryIcon = () => <ClipboardList size={16} />;

// ── SUPPLIER MANAGEMENT (List / Search / Filter / Add / View / Update)
const SuppliersPage = ({ data, setData }: { data: AppData; setData: (d: AppData) => void }) => {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<SupplierStatus | "">("");
  const [modalAdd, setModalAdd] = React.useState(false);
  const [view, setView] = React.useState<Supplier | null>(null);
  const [edit, setEdit] = React.useState<Supplier | null>(null);
  const [addForm, setAddForm] = React.useState({ companyName: "", contactPerson: "", contactEmail: "", contactPhone: "", address: "", status: "Active" as SupplierStatus, productsText: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const filtered = data.suppliers.filter(s => {
    const qq = q.toLowerCase();
    const matchQ = !qq || s.id.toLowerCase().includes(qq) || s.companyName.toLowerCase().includes(qq) || s.contactPerson.toLowerCase().includes(qq) || s.productsSupplied.some(p => p.name.toLowerCase().includes(qq));
    const matchS = !status || s.status === status;
    return matchQ && matchS;
  }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const validateAdd = () => {
    const e: Record<string, string> = {};
    if (!addForm.companyName.trim()) e.companyName = "Required";
    if (!addForm.contactPerson.trim()) e.contactPerson = "Required";
    if (!addForm.contactEmail.trim() || !/\S+@\S+\.\S+/.test(addForm.contactEmail)) e.contactEmail = "Valid email required";
    if (!addForm.contactPhone.trim()) e.contactPhone = "Required";
    if (!addForm.address.trim()) e.address = "Required";
    return e;
  };
  const handleAdd = () => {
    const e = validateAdd(); if (Object.keys(e).length) { setErrors(e); return; }
    const prods: SupplierProduct[] = addForm.productsText.split(",").map(s => s.trim()).filter(Boolean).map((name, i) => ({ id: Math.random().toString(36).slice(2), name, category: "General Merchandise" }));
    const sup: Supplier = {
      id: genId("SUP"), companyName: addForm.companyName.trim(), contactPerson: addForm.contactPerson.trim(),
      contactEmail: addForm.contactEmail.trim(), contactPhone: addForm.contactPhone.trim(),
      address: addForm.address.trim(), status: addForm.status, productsSupplied: prods, createdAt: now(),
    };
    setData({ ...data, suppliers: [sup, ...data.suppliers] });
    setModalAdd(false); setAddForm({ companyName: "", contactPerson: "", contactEmail: "", contactPhone: "", address: "", status: "Active", productsText: "" }); setErrors({});
  };
  const handleUpdate = () => {
    if (!edit) return;
    setData({ ...data, suppliers: data.suppliers.map(s => s.id === edit.id ? edit : s) });
    setEdit(null);
  };
  const handleDelete = (id: string) => {
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    setData({ ...data, suppliers: data.suppliers.filter(s => s.id !== id) });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Btn size="sm" onClick={() => setModalAdd(true)}><Plus size={14} /> Add Supplier</Btn>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search Supplier ID, company, contact, product…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="relative sm:w-48">
            <select className={selectCls} value={status} onChange={e => setStatus(e.target.value as SupplierStatus | "")}>
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      <div className="hidden lg:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Contact Person</th>
                  <th className="text-left px-4 py-3">Contact Information</th>
                  <th className="text-left px-4 py-3">Address</th>
                  <th className="text-left px-4 py-3">Products Supplied</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">{s.companyName}</p>
                      <MonoId id={s.id} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{s.contactPerson}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{s.contactEmail}</div>
                      <div className="flex items-center gap-1.5 mt-1"><Phone size={12} className="text-slate-400" />{s.contactPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">{s.address}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.productsSupplied.length ? s.productsSupplied.map(p => p.name).join(", ") : "—"}</td>
                    <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setView(s)} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 hover:text-violet-700" title="View"><Eye size={14} /></button>
                        <button onClick={() => setEdit({ ...s })} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 hover:text-violet-700" title="Update"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">No suppliers match your search / filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
        {filtered.map(s => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div><p className="text-sm font-bold text-slate-800">{s.companyName}</p><MonoId id={s.id} /></div>
              <StatusPill status={s.status} />
            </div>
            <div className="space-y-1 text-xs text-slate-600 mb-3">
              <div className="flex gap-2"><Users size={12} className="text-slate-400 mt-0.5" />{s.contactPerson}</div>
              <div className="flex gap-2"><Mail size={12} className="text-slate-400 mt-0.5" />{s.contactEmail}</div>
              <div className="flex gap-2"><MapPin size={12} className="text-slate-400 mt-0.5" />{s.address}</div>
              <div className="flex gap-2"><Package size={12} className="text-slate-400 mt-0.5" />{s.productsSupplied.map(p => p.name).join(", ") || "—"}</div>
            </div>
            <div className="flex gap-2">
              <Btn size="sm" variant="secondary" className="flex-1" onClick={() => setView(s)}><Eye size={12} /> View</Btn>
              <Btn size="sm" className="flex-1" onClick={() => setEdit({ ...s })}><Pencil size={12} /> Update</Btn>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-8 text-center col-span-full text-sm text-slate-400">No suppliers found.</Card>}
      </div>

      {/* Add Supplier */}
      <Modal open={modalAdd} onClose={() => setModalAdd(false)} title="Add Supplier Information"
        footer={<div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => setModalAdd(false)}>Cancel</Btn><Btn size="sm" onClick={handleAdd}><Save size={14} /> Add Supplier</Btn></div>}>
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2 text-xs text-violet-700"><Info size={14} className="shrink-0" /> Supplier ID is auto-generated. Fill all required fields.</div>
          <Field label="Company Name" required error={errors.companyName}><input className={inp} value={addForm.companyName} onChange={e => setAddForm({ ...addForm, companyName: e.target.value })} placeholder="e.g. Pacific Dry Goods Trading" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Person" required error={errors.contactPerson}><input className={inp} value={addForm.contactPerson} onChange={e => setAddForm({ ...addForm, contactPerson: e.target.value })} /></Field>
            <Field label="Supplier Status"><div className="relative"><select className={selectCls} value={addForm.status} onChange={e => setAddForm({ ...addForm, status: e.target.value as SupplierStatus })}><option value="Active">Active</option><option value="Inactive">Inactive</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Email" required error={errors.contactEmail}><input className={inp} value={addForm.contactEmail} onChange={e => setAddForm({ ...addForm, contactEmail: e.target.value })} placeholder="name@company.com" /></Field>
            <Field label="Contact Phone" required error={errors.contactPhone}><input className={inp} value={addForm.contactPhone} onChange={e => setAddForm({ ...addForm, contactPhone: e.target.value })} placeholder="+63 9xx xxx xxxx" /></Field>
          </div>
          <Field label="Address" required error={errors.address}><textarea className={`${inp} resize-none`} rows={2} value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} placeholder="Complete business address" /></Field>
          <Field label="Products Supplied" hint="Comma-separated, e.g. Jasmine Rice, Canned Sardines"><input className={inp} value={addForm.productsText} onChange={e => setAddForm({ ...addForm, productsText: e.target.value })} placeholder="Product 1, Product 2" /></Field>
        </div>
      </Modal>

      {/* View Supplier */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `View Supplier · ${view.companyName}` : "View Supplier"} maxW="max-w-[560px]"
        footer={view && <div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => setView(null)}>Close</Btn><Btn size="sm" onClick={() => { if (view) setEdit({ ...view }); setView(null); }}><Pencil size={14} /> Update Supplier</Btn></div>}>
        {view && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><MonoId id={view.id} /><StatusPill status={view.status} /></div>
            {[
              { k: "Company Name", v: view.companyName, i: <Building2 size={14} /> },
              { k: "Contact Person", v: view.contactPerson, i: <Users size={14} /> },
              { k: "Contact Information", v: `${view.contactEmail} · ${view.contactPhone}`, i: <Mail size={14} /> },
              { k: "Address", v: view.address, i: <MapPin size={14} /> },
              { k: "Products Supplied", v: view.productsSupplied.map(p => p.name).join(", ") || "—", i: <Package size={14} /> },
              { k: "Supplier Status", v: view.status, i: <ShieldCheck size={14} /> },
            ].map(r => (
              <div key={r.k} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
                <div className="text-slate-400 mt-0.5">{r.i}</div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{r.k}</p>
                  <p className="text-sm text-slate-700">{r.v}</p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-400">Registered {fmtDate(view.createdAt)}</p>
          </div>
        )}
      </Modal>

      {/* Update Supplier */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Update Supplier Information"
        footer={edit && <div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => setEdit(null)}>Cancel</Btn><Btn size="sm" onClick={handleUpdate}><Save size={14} /> Save Changes</Btn></div>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Supplier ID"><input className={inp} value={edit.id} disabled /></Field>
            <Field label="Company Name"><input className={inp} value={edit.companyName} onChange={e => setEdit({ ...edit, companyName: e.target.value })} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Person"><input className={inp} value={edit.contactPerson} onChange={e => setEdit({ ...edit, contactPerson: e.target.value })} /></Field>
              <Field label="Status"><div className="relative"><select className={selectCls} value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value as SupplierStatus })}><option value="Active">Active</option><option value="Inactive">Inactive</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Email"><input className={inp} value={edit.contactEmail} onChange={e => setEdit({ ...edit, contactEmail: e.target.value })} /></Field>
              <Field label="Contact Phone"><input className={inp} value={edit.contactPhone} onChange={e => setEdit({ ...edit, contactPhone: e.target.value })} /></Field>
            </div>
            <Field label="Address"><textarea className={`${inp} resize-none`} rows={2} value={edit.address} onChange={e => setEdit({ ...edit, address: e.target.value })} /></Field>
            <Field label="Products Supplied" hint="Comma-separated"><input className={inp} value={edit.productsSupplied.map(p => p.name).join(", ")} onChange={e => setEdit({ ...edit, productsSupplied: e.target.value.split(",").map(s => s.trim()).filter(Boolean).map((name, i) => ({ id: `sp-${i}`, name, category: "General Merchandise" })) })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ── TRANSACTIONS (Record Transaction workflow)
const TransactionsPage = ({ data, setData }: { data: AppData; setData: (d: AppData) => void }) => {
  const [q, setQ] = React.useState("");
  const [dcFilter, setDcFilter] = React.useState<DeliveryCheck | "">("");
  const [open, setOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState("");
  const [items, setItems] = React.useState<TxnItem[]>([{ productName: "", qty: 1, unitCost: 0, subtotal: 0 }]);
  const [notes, setNotes] = React.useState("");
  const [expectedDelivery, setExpectedDelivery] = React.useState("");
  const [actualDelivery, setActualDelivery] = React.useState("");
  const [deliveryCheck, setDeliveryCheck] = React.useState<DeliveryCheck>("pending");
  const [issueType, setIssueType] = React.useState(ISSUE_TYPES[0]);
  const [issueDesc, setIssueDesc] = React.useState("");
  const [err, setErr] = React.useState("");

  const filtered = data.transactions.filter(t => {
    const qq = q.toLowerCase();
    const matchQ = !qq || t.id.toLowerCase().includes(qq) || t.supplierName.toLowerCase().includes(qq) || t.items.some(i => i.productName.toLowerCase().includes(qq));
    const matchDc = !dcFilter || t.deliveryCheck === dcFilter;
    return matchQ && matchDc;
  }).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const totalCost = items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.unitCost) || 0), 0);
  const totalQty = items.reduce((a, i) => a + (Number(i.qty) || 0), 0);

  const reset = () => {
    setSupplierId(""); setItems([{ productName: "", qty: 1, unitCost: 0, subtotal: 0 }]); setNotes(""); setExpectedDelivery(""); setActualDelivery(""); setDeliveryCheck("pending"); setIssueType(ISSUE_TYPES[0]); setIssueDesc(""); setErr("");
  };
  const handleSave = () => {
    setErr("");
    if (!supplierId) { setErr("Select a supplier."); return; }
    if (items.length === 0 || items.some(i => !i.productName.trim() || i.qty <= 0 || i.unitCost < 0)) { setErr("Add at least one product with quantity > 0 and valid cost."); return; }
    if (deliveryCheck === "issue" && !issueDesc.trim()) { setErr("Describe the delivery issue."); return; }
    const sup = data.suppliers.find(s => s.id === supplierId);
    const txn: SupplierTransaction = {
      id: genId("TXN"), supplierId, supplierName: sup?.companyName ?? supplierId, date: now(),
      items: items.map(i => ({ ...i, subtotal: i.qty * i.unitCost })), totalQty, totalCost, notes: notes.trim(),
      expectedDelivery, actualDelivery, deliveryCheck, stockUpdated: deliveryCheck === "complete",
      issue: deliveryCheck === "issue" ? { type: issueType, description: issueDesc.trim() } : undefined,
    };
    setData({ ...data, transactions: [txn, ...data.transactions] });
    setOpen(false); reset();
  };

  const updateItem = (idx: number, patch: Partial<TxnItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch, subtotal: (patch.qty ?? it.qty) * (patch.unitCost ?? it.unitCost) } : it));
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Btn size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Record Transaction</Btn>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search Txn ID, supplier, product…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="relative sm:w-56">
            <select className={selectCls} value={dcFilter} onChange={e => setDcFilter(e.target.value as DeliveryCheck | "")}>
              <option value="">All delivery checks</option>
              <option value="pending">Pending Delivery</option>
              <option value="complete">Complete & Correct</option>
              <option value="issue">Delivery Issue</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3">Transaction</th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Purchased Products</th>
                <th className="text-left px-4 py-3">Qty / Cost</th>
                <th className="text-left px-4 py-3">Delivery</th>
                <th className="text-left px-4 py-3">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3"><MonoId id={t.id} /><p className="text-xs text-slate-400">{fmtDate(t.date)}</p><p className="text-[11px] text-slate-500 truncate">{t.notes || "—"}</p></td>
                  <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-700">{t.supplierName}</p><MonoId id={t.supplierId} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]">{t.items.map(i => `${i.productName} (${i.qty})`).join(", ")}</td>
                  <td className="px-4 py-3"><p className="text-xs font-semibold text-slate-700">{t.totalQty} units</p><p className="text-xs text-slate-600">{peso(t.totalCost)}</p></td>
                  <td className="px-4 py-3"><DeliveryPill dc={t.deliveryCheck} />{t.deliveryCheck === "issue" && t.issue && <p className="text-[11px] text-red-600 mt-1">{t.issue.type}</p>}</td>
                  <td className="px-4 py-3">{t.stockUpdated ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full"><PackageCheck size={12} /> Updated</span> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-400">No transactions found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => { setOpen(false); reset(); }} title="Record Supplier Transaction" maxW="max-w-[760px]"
        footer={
          <div className="flex flex-col gap-3">
            {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-600"><AlertTriangle size={14} className="shrink-0" />{err}</div>}
            <div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => { setOpen(false); reset(); }}>Cancel</Btn><Btn size="sm" onClick={handleSave}><Save size={14} /> {deliveryCheck === "complete" ? "Save & Update Stock" : deliveryCheck === "issue" ? "Save & Record Issue" : "Save Transaction"}</Btn></div>
          </div>
        }>
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
            <span className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs">1</span> Select Supplier
            <span className="flex-1 h-px bg-slate-200" />
            <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs">2</span> Purchased Products & Qty/Cost
            <span className="flex-1 h-px bg-slate-200" />
            <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs">3</span> Delivery Check
          </div>

          <Field label="Select Supplier" required>
            <div className="relative">
              <select className={selectCls} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— Choose supplier —</option>
                {data.suppliers.filter(s => s.status === "Active").map(s => <option key={s.id} value={s.id}>{s.companyName} · {s.id}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Purchased Products — Quantity / Cost</p>
              <button onClick={() => setItems([...items, { productName: "", qty: 1, unitCost: 0, subtotal: 0 }])} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1"><Plus size={12} /> Add item</button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.7fr_0.7fr_0.9fr_auto] gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                  <input className={inp} value={it.productName} onChange={e => updateItem(idx, { productName: e.target.value })} placeholder="Product name" />
                  <input type="number" min={1} className={inp} value={it.qty} onChange={e => updateItem(idx, { qty: Number(e.target.value) })} placeholder="Qty" />
                  <input type="number" min={0} step="0.01" className={inp} value={it.unitCost} onChange={e => updateItem(idx, { unitCost: Number(e.target.value) })} placeholder="Unit cost" />
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4 mt-3 text-sm">
              <span className="text-slate-500">Total Qty: <strong className="text-slate-800">{totalQty}</strong></span>
              <span className="text-slate-500">Total Cost: <strong className="text-slate-800">{peso(totalCost)}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Transaction Notes"><input className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Invoice / PO ref, remarks" /></Field>
            <Field label="Expected Delivery"><input type="date" className={inp} value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} /></Field>
          </div>
          <Field label="Actual Delivery Date" hint="Leave blank if pending"><input type="date" className={inp} value={actualDelivery} onChange={e => setActualDelivery(e.target.value)} /></Field>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
            <p className="text-sm font-bold text-slate-800 mb-3">Delivery Complete & Correct?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { v: "pending" as DeliveryCheck, label: "Pending", desc: "Not yet delivered" },
                { v: "complete" as DeliveryCheck, label: "YES — Complete & Correct", desc: "→ Update Product Stock" },
                { v: "issue" as DeliveryCheck, label: "NO — Has Issue", desc: "→ Record Delivery Issue" },
              ]).map(o => (
                <button key={o.v} onClick={() => setDeliveryCheck(o.v)}
                  className={`p-3 rounded-xl border text-left ${deliveryCheck === o.v ? "bg-white border-violet-300 ring-2 ring-violet-100" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <p className="text-xs font-bold text-slate-800">{o.label}</p>
                  <p className="text-[11px] text-slate-500">{o.desc}</p>
                </button>
              ))}
            </div>
            {deliveryCheck === "complete" && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2 text-xs text-green-700">
                <PackageCheck size={14} className="shrink-0 mt-0.5" /> Product Stock will be updated upon save.
              </div>
            )}
            {deliveryCheck === "issue" && (
              <div className="mt-3 space-y-3">
                <Field label="Issue Type" required>
                  <div className="relative"><select className={selectCls} value={issueType} onChange={e => setIssueType(e.target.value)}>{ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div>
                </Field>
                <Field label="Issue Details" required><textarea className={`${inp} resize-none`} rows={2} value={issueDesc} onChange={e => setIssueDesc(e.target.value)} placeholder="Describe shortage, damage, discrepancy…" /></Field>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── DELIVERY ISSUES
const IssuesPage = ({ data, setData }: { data: AppData; setData: (d: AppData) => void }) => {
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<SupplierTransaction | null>(null);
  const issues = data.transactions.filter(t => t.deliveryCheck === "issue").filter(t => {
    const qq = q.toLowerCase();
    return !qq || t.id.toLowerCase().includes(qq) || t.supplierName.toLowerCase().includes(qq) || (t.issue?.description.toLowerCase().includes(qq) ?? false);
  }).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const resolve = (id: string) => {
    setData({ ...data, transactions: data.transactions.map(t => t.id === id ? { ...t, deliveryCheck: "complete" as DeliveryCheck, stockUpdated: true, actualDelivery: t.actualDelivery || new Date().toISOString().slice(0, 10) } : t) });
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inp} pl-9`} placeholder="Search issue, supplier, Txn ID…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {issues.map(t => (
          <Card key={t.id} className="p-5 border-red-100">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> {t.issue?.type}</p><MonoId id={t.id} /> <MonoId id={t.supplierId} /></div>
              <DeliveryPill dc={t.deliveryCheck} />
            </div>
            <p className="text-sm font-semibold text-slate-700">{t.supplierName}</p>
            <p className="text-xs text-slate-500 mb-2">{t.items.map(i => `${i.productName} ×${i.qty}`).join(", ")} · {peso(t.totalCost)}</p>
            <p className="text-xs text-slate-600 bg-red-50 border border-red-100 rounded-lg p-2.5">{t.issue?.description}</p>
            <div className="flex gap-2 mt-3">
              <Btn size="sm" variant="secondary" className="flex-1" onClick={() => setEditing({ ...t })}><Pencil size={12} /> Edit Issue</Btn>
              <Btn size="sm" className="flex-1" onClick={() => resolve(t.id)}><CheckCircle2 size={12} /> Mark Resolved → Stock</Btn>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Recorded {fmtDate(t.date)} · Expected {fmtDate(t.expectedDelivery)}</p>
          </Card>
        ))}
        {issues.length === 0 && <Card className="p-10 text-center col-span-full"><PackageCheck size={32} className="text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No delivery issues recorded.</p></Card>}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Record Delivery Issue · ${editing?.id ?? ""}`}
        footer={editing && <div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Btn><Btn size="sm" onClick={() => { if (!editing) return; const next = { ...editing, issue: { type: editing.issue?.type ?? ISSUE_TYPES[0], description: editing.issue?.description ?? "" } }; setData({ ...data, transactions: data.transactions.map(t => t.id === next.id ? next : t) }); setEditing(null); }}><Save size={14} /> Save</Btn></div>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Issue Type"><div className="relative"><select className={selectCls} value={editing.issue?.type ?? ISSUE_TYPES[0]} onChange={e => setEditing({ ...editing, issue: { type: e.target.value, description: editing.issue?.description ?? "" } })}>{ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div></Field>
            <Field label="Issue Details"><textarea className={`${inp} resize-none`} rows={3} value={editing.issue?.description ?? ""} onChange={e => setEditing({ ...editing, issue: { type: editing.issue?.type ?? ISSUE_TYPES[0], description: e.target.value } })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ── PERFORMANCE / EVALUATION
const PerformancePage = ({ data, setData }: { data: AppData; setData: (d: AppData) => void }) => {
  const [open, setOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState("");
  const [deliveryScore, setDeliveryScore] = React.useState(80);
  const [qualityScore, setQualityScore] = React.useState(85);
  const [remarks, setRemarks] = React.useState("");
  const [period, setPeriod] = React.useState("Q1 2026");
  const [q, setQ] = React.useState("");

  const overall = Math.round((deliveryScore + qualityScore) / 2);

  const filteredEvals = [...data.evaluations].filter(e => {
    const qq = q.toLowerCase();
    return !qq || e.supplierName.toLowerCase().includes(qq) || e.period.toLowerCase().includes(qq);
  }).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const bySupplier = data.suppliers.map(s => {
    const txns = data.transactions.filter(t => t.supplierId === s.id);
    const evs = data.evaluations.filter(e => e.supplierId === s.id);
    const avg = evs.length ? Math.round(evs.reduce((a, e) => a + e.overallScore, 0) / evs.length) : 0;
    const completed = txns.filter(t => t.deliveryCheck === "complete").length;
    const issues = txns.filter(t => t.deliveryCheck === "issue").length;
    const deliveryPerf = txns.length ? Math.round((completed / txns.length) * 100) : 0;
    return { s, txns, evs, avg, deliveryPerf, issues };
  });

  const handleEval = () => {
    if (!supplierId) return;
    const sup = data.suppliers.find(s => s.id === supplierId);
    const ev: Evaluation = {
      id: genId("EV"), supplierId, supplierName: sup?.companyName ?? supplierId, date: now(), period,
      deliveryScore, qualityScore, overallScore: overall, remarks: remarks.trim() || "—",
    };
    setData({ ...data, evaluations: [ev, ...data.evaluations] });
    setOpen(false); setSupplierId(""); setRemarks("");
  };

  const supplierTxns = supplierId ? data.transactions.filter(t => t.supplierId === supplierId).length : 0;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Btn size="sm" onClick={() => setOpen(true)}><Award size={14} /> Evaluate Supplier</Btn>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inp} pl-9`} placeholder="Search supplier or period…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bySupplier.map(({ s, avg, deliveryPerf, issues, txns }) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div><p className="text-sm font-bold text-slate-800 truncate">{s.companyName}</p><MonoId id={s.id} /></div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${avg >= 80 ? "bg-green-50 text-green-700 border border-green-200" : avg >= 60 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{avg || "—"}</div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Transactions</span><span className="font-semibold text-slate-700">{txns.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Delivery Performance</span><span className="font-semibold text-slate-700">{deliveryPerf}%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Quality / Issues</span><span className="font-semibold text-slate-700">{issues} issue{issues !== 1 ? "s" : ""}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Overall Score</span><span className="font-bold text-[#5b21b6]">{avg || "Not evaluated"}</span></div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-3"><div className="h-full bg-[#5b21b6]" style={{ width: `${avg}%` }} /></div>
            <button onClick={() => { setSupplierId(s.id); setOpen(true); }} className="mt-3 w-full text-xs font-semibold text-violet-600 hover:text-violet-800 border border-violet-200 rounded-lg py-2 hover:bg-violet-50">Evaluate this supplier</button>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4"><Award size={16} className="text-violet-600" /><h3 className="text-sm font-bold text-slate-800">Evaluation History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-4 py-2">Supplier</th><th className="text-left px-4 py-2">Period</th><th className="text-left px-4 py-2">Delivery</th><th className="text-left px-4 py-2">Quality</th><th className="text-left px-4 py-2">Overall</th><th className="text-left px-4 py-2">Remarks</th><th className="text-left px-4 py-2">Date</th>
            </tr></thead>
            <tbody>
              {filteredEvals.map(e => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">{e.supplierName}<div className="text-[11px] font-normal text-slate-400"><MonoId id={e.supplierId} /></div></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{e.period}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{e.deliveryScore}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{e.qualityScore}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs border border-violet-200">{e.overallScore}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{e.remarks}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.date)}</td>
                </tr>
              ))}
              {filteredEvals.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">No evaluations yet. Record one to build performance history.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Evaluate Supplier → Record Supplier Evaluation" maxW="max-w-[640px]"
        footer={<div className="flex gap-3 justify-end"><Btn variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Btn><Btn size="sm" onClick={handleEval} disabled={!supplierId}><Save size={14} /> Record Evaluation</Btn></div>}>
        <div className="space-y-4">
          <Field label="Supplier" required>
            <div className="relative">
              <select className={selectCls} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— Select supplier —</option>
                {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.companyName} · {s.id}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
          {supplierId && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
              {supplierTxns} transaction{supplierTxns !== 1 ? "s" : ""} found for this supplier.
            </div>
          )}
          <Field label="Evaluation Period"><input className={inp} value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. Q1 2026" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={`Delivery Performance: ${deliveryScore}`}>
              <input type="range" min={0} max={100} value={deliveryScore} onChange={e => setDeliveryScore(Number(e.target.value))} className="w-full" />
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${deliveryScore}%` }} /></div>
            </Field>
            <Field label={`Product / Quality Performance: ${qualityScore}`}>
              <input type="range" min={0} max={100} value={qualityScore} onChange={e => setQualityScore(Number(e.target.value))} className="w-full" />
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${qualityScore}%` }} /></div>
            </Field>
          </div>
          <Card className="p-4 bg-violet-50 border-violet-200">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Overall Performance</p><p className="text-2xl font-bold text-[#5b21b6]">{overall}</p></div>
              <Stars rating={overall / 20} />
            </div>
          </Card>
          <Field label="Remarks / Feedback"><textarea className={`${inp} resize-none`} rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Strengths, issues, recommendations…" /></Field>
        </div>
      </Modal>
    </div>
  );
};

// ── SHELL
type Page = "dashboard" | "suppliers" | "transactions" | "issues" | "performance";
const NAV: { icon: React.ReactNode; label: string; page: Page }[] = [
  { icon: <LayoutDashboard size={17} />, label: "Dashboard", page: "dashboard" },
  { icon: <Users size={17} />, label: "Suppliers", page: "suppliers" },
  { icon: <ShoppingCart size={17} />, label: "Transactions", page: "transactions" },
  { icon: <Truck size={17} />, label: "Delivery Issues", page: "issues" },
  { icon: <Award size={17} />, label: "Performance", page: "performance" },
];

export default function SupplierPortal({ supplierId: _sid, onLogout }: { supplierId: string; onLogout: () => void }) {
  const [data, setData] = useAppData();
  const [page, setPage] = React.useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const issueCount = data.transactions.filter(t => t.deliveryCheck === "issue").length;
  const pendingCount = data.transactions.filter(t => t.deliveryCheck === "pending").length;

  const Sidebar = ({ mobile = false, collapsed = false, onToggleCollapse }: { mobile?: boolean; collapsed?: boolean; onToggleCollapse?: () => void }) => {
    const isCollapsed = mobile ? false : collapsed;
    return (
      <div className="flex flex-col h-full bg-[#1e0a4a]">
        <div className={`flex items-center gap-2.5 px-4 pt-5 pb-3 ${isCollapsed ? "px-2 justify-center" : ""}`}>
          <div className={`shrink-0 rounded-lg flex items-center justify-center border border-violet-400/30 bg-violet-400/20 ${isCollapsed ? "w-7 h-7" : "w-8 h-8"}`}>
            <Boxes size={isCollapsed ? 15 : 16} className="text-violet-300" />
          </div>
          {!isCollapsed && <div className="text-left leading-tight min-w-0"><div className="text-xs font-bold text-white tracking-wide truncate">TRI-M SUPPLIER</div><div className="text-[10px] text-slate-400 tracking-wider">VENDOR MANAGEMENT</div></div>}
        </div>
        <nav className={isCollapsed ? "flex-1 py-2 px-2 space-y-1" : "flex-1 overflow-y-auto py-2 px-3 space-y-1"}>
          {NAV.map(({ icon, label, page: p }) => (
            <button key={p} onClick={() => { setPage(p); setMobileOpen(false); }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${isCollapsed ? "justify-center" : ""} ${page === p ? "bg-violet-500/20 text-white" : "text-slate-300 hover:text-white hover:bg-white/5"}`}>
              {icon}
              {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
              {!isCollapsed && p === "issues" && issueCount > 0 && <span className="bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{issueCount}</span>}
              {!isCollapsed && p === "transactions" && pendingCount > 0 && <span className="bg-amber-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
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
            <button onClick={onToggleCollapse} className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 ${isCollapsed ? "justify-center" : ""}`}>
              {isCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="flex-1 text-left">Collapse Sidebar</span></>}
              {isCollapsed && <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100">Expand Sidebar</span>}
            </button>
          )}
        </div>
      </div>
    );
  };

  const currentLabel = NAV.find(n => n.page === page)?.label ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className={`hidden lg:flex shrink-0 bg-[#1e0a4a] transition-[width] duration-300 ease-in-out ${collapsed ? "w-[76px]" : "w-64"}`}>
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
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
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div key={page} className="page-enter mx-auto max-w-[1440px]">
            {page === "dashboard" && <Dashboard data={data} onNav={setPage} />}
            {page === "suppliers" && <SuppliersPage data={data} setData={setData} />}
            {page === "transactions" && <TransactionsPage data={data} setData={setData} />}
            {page === "issues" && <IssuesPage data={data} setData={setData} />}
            {page === "performance" && <PerformancePage data={data} setData={setData} />}
          </div>
        </main>
        <div id="modal-portal" />
      </div>
    </div>
  );
}
