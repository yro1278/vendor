import * as React from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Truck, History, Award,
  LogOut, Menu, X, Eye, CheckCircle2, Plus, Star, Phone, Mail, Globe, MapPin,
  Briefcase, FileText, AlertTriangle, Calendar, Pencil, Save, CheckCircle,
  Clock, TrendingUp, Boxes, Search, Info, ChevronDown, Bell, CircleCheck, CircleDot,
  Ban, Filter, ChevronRight, ChevronLeft, ShieldCheck, ClipboardList, PackageCheck, Users,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  TRI-M GLOBAL LOGISTICS & TRADING INC. — VENDOR/SUPPLIER PORTAL
//  Standalone supplier-facing portal (sample data, ready for backend integration)
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

type POStatus = "pending" | "confirmed" | "processing" | "ready" | "completed" | "cancelled";
type DeliveryStatus = "pending" | "processing" | "shipped" | "delivered" | "completed";
type TxnStatus = "Completed" | "Pending";
type NotifType = "purchase_order" | "po_update" | "delivery" | "transaction" | "performance" | "announcement";

interface OrderItem { productName: string; qty: string; unit: string; }

interface PurchaseOrder {
  id: string;
  orderDate: string;
  expectedDelivery: string;
  items: OrderItem[];
  status: POStatus;
  total: string;
}

interface Delivery {
  id: string;
  poId: string;
  deliveryDate: string;
  expectedDelivery: string;
  deliveryStatus: DeliveryStatus;
  fulfillmentStatus: string;
  carrier: string;
  trackingNo: string;
  notes: string;
}

interface Transaction {
  id: string;
  poId: string;
  date: string;
  products: string;
  amount: string;
  deliveryStatus: string;
  transactionStatus: TxnStatus;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  read: boolean;
  timestamp: string;
}

interface Evaluation {
  id: string;
  period: string;
  date: string;
  score: number;
  rating: number;
  note: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  availability: "In Stock" | "Low Stock" | "Out of Stock" | "Made to Order";
  status: "Active" | "Pending Review";
  lastUpdated: string;
}

interface Supplier {
  id: string;
  companyName: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  contactPhone: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  supplierType: string;
  yearsInBusiness: string;
  distributionArea: string;
  paymentTerms: string;
  leadTime: string;
  deliveryCapability: string;
  status: "Active" | "Inactive";
  approvedAt: string;
  evaluationScore: number;
  performanceRating: number;
  lastEvaluated: string;
  products: Product[];
  documents: { type: string; fileName: string }[];
}

interface PortalData {
  supplier: Supplier;
  orders: PurchaseOrder[];
  deliveries: Delivery[];
  transactions: Transaction[];
  notifications: AppNotification[];
  evaluations: Evaluation[];
}

// ─────────────────────────────────────────────────────────
// CONSTANTS / STATUS CONFIG
// ─────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = ["Dry Products", "Frozen Products", "Cosmetic Products"];

const PO_STEPS: POStatus[] = ["pending", "confirmed", "processing", "ready", "completed"];
const DELIVERY_STEPS: DeliveryStatus[] = ["pending", "processing", "shipped", "delivered", "completed"];

const PO_STATUS: Record<POStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={12} /> },
  confirmed: { label: "Confirmed", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: <CircleCheck size={12} /> },
  processing: { label: "Processing", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: <ClipboardList size={12} /> },
  ready: { label: "Ready for Delivery", cls: "bg-violet-50 text-violet-700 border-violet-200", icon: <PackageCheck size={12} /> },
  completed: { label: "Completed", cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle size={12} /> },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-700 border-red-200", icon: <Ban size={12} /> },
};

const PO_NEXT: Partial<Record<POStatus, { next: POStatus; label: string }>> = {
  pending: { next: "confirmed", label: "Acknowledge / Confirm" },
  confirmed: { next: "processing", label: "Start Processing" },
  processing: { next: "ready", label: "Mark Ready for Delivery" },
};

const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={12} /> },
  processing: { label: "Processing", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: <ClipboardList size={12} /> },
  shipped: { label: "Shipped", cls: "bg-violet-50 text-violet-700 border-violet-200", icon: <Truck size={12} /> },
  delivered: { label: "Delivered", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: <CircleDot size={12} /> },
  completed: { label: "Completed", cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle size={12} /> },
};

const DELIVERY_NEXT: Record<DeliveryStatus, DeliveryStatus | null> = {
  pending: "processing",
  processing: "shipped",
  shipped: "delivered",
  delivered: "completed",
  completed: null,
};

const TXN_STATUS: Record<TxnStatus, { cls: string }> = {
  Completed: { cls: "bg-green-50 text-green-700 border-green-200" },
  Pending: { cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const NOTIF_META: Record<NotifType, { label: string; cls: string; icon: React.ReactNode }> = {
  purchase_order: { label: "New Purchase Order", cls: "bg-violet-50 text-violet-700", icon: <ShoppingCart size={15} /> },
  po_update: { label: "PO Update", cls: "bg-sky-50 text-sky-700", icon: <ClipboardList size={15} /> },
  delivery: { label: "Delivery Update", cls: "bg-amber-50 text-amber-700", icon: <Truck size={15} /> },
  transaction: { label: "Transaction", cls: "bg-green-50 text-green-700", icon: <History size={15} /> },
  performance: { label: "Performance Evaluation", cls: "bg-indigo-50 text-indigo-700", icon: <Award size={15} /> },
  announcement: { label: "Announcement", cls: "bg-slate-100 text-slate-600", icon: <Bell size={15} /> },
};

// ─────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const genId = (pfx: string) => `${pfx}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
const fmtDateTime = (s: string) => new Date(s).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

// ─────────────────────────────────────────────────────────
// SHARED UI (consistent Tri-M violet design system)
// ─────────────────────────────────────────────────────────

const inp = "w-full min-h-[44px] px-3.5 py-2.5 text-[15px] sm:text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b21b6]/30 focus:border-[#5b21b6]/40 transition-colors";
const selectCls = `${inp} cursor-pointer appearance-none`;

const Btn = ({ variant = "primary", size = "md", className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }) => {
  const v = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-ghost";
  const sz = size === "sm" ? "px-3.5 py-2 text-xs" : "px-4 py-2.5 text-sm";
  return <button className={`btn ${v} ${sz} ${className}`} {...rest}>{children}</button>;
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`surface ${className}`}>{children}</div>
);

const Field = ({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {hint && <p className="text-xs text-slate-400 -mt-1">{hint}</p>}
    {children}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const SectionHeader = ({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-50 text-violet-600 shrink-0">{icon}</div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-slate-800 truncate">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={13} className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"} />
    ))}
    <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>
  </div>
);

const MonoId = ({ id }: { id: string }) => (
  <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded tracking-tight">{id}</span>
);

const KpiCard = ({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string; sub?: string }) => (
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

const StatusPill = ({ cfg }: { cfg: { label: string; cls: string; icon: React.ReactNode } }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${cfg.cls}`}>
    {cfg.icon}{cfg.label}
  </span>
);

const TableScroll = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`w-full overflow-x-auto ${className}`}>{children}</div>
);

const Stepper = ({ steps, current, color = "#5b21b6" }: { steps: string[]; current: string; color?: string }) => {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex-1 h-1 rounded-full transition-colors" style={{ background: i <= idx ? color : "#e2e8f0" }} />
      ))}
    </div>
  );
};

const Modal = ({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) => {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="absolute inset-0 z-50 flex items-center justify-center pt-14 px-4 sm:px-6">
      <div className="modal-backdrop absolute top-14 inset-x-0 bottom-0 bg-black/40" onClick={onClose} />
      <div className="modal-panel relative z-10 bg-white flex flex-col rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 truncate">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100 p-2 shrink-0 -mr-2"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 py-4 bg-white">{footer}</div>}
      </div>
    </div>,
    document.getElementById("modal-portal") ?? document.body
  );
};

// ─────────────────────────────────────────────────────────
// SAMPLE DATA (standalone — replaces backend until integrated)
// ─────────────────────────────────────────────────────────

const SAMPLE_SUPPLIER: Supplier = {
  id: "SUP-2024-10001",
  companyName: "BeautyPH Cosmetics Inc.",
  contactName: "Ana Reyes",
  contactPosition: "Account Executive",
  contactEmail: "a.reyes@beautyphcosmetics.com",
  contactPhone: "+63 920 543 2109",
  email: "a.reyes@beautyphcosmetics.com",
  phone: "+63 920 543 2109",
  address: "78 Shaw Blvd, Mandaluyong City, Metro Manila",
  website: "www.beautyphcosmetics.com",
  supplierType: "Importer",
  yearsInBusiness: "5",
  distributionArea: "Metro Manila, Cebu, Davao",
  paymentTerms: "45 days credit",
  leadTime: "14–21 days (imported goods)",
  deliveryCapability: "Courier partners (LBC, J&T Express), in-house delivery within Metro Manila",
  status: "Active",
  approvedAt: daysFromNow(-220),
  evaluationScore: 87,
  performanceRating: 4.2,
  lastEvaluated: daysFromNow(-12),
  products: [
    { id: "p1", name: "Korean BB Cream SPF 50+", category: "Cosmetic Products", description: "Multi-function BB cream with sun protection and moisturizing formula.", price: "₱350–420/unit", availability: "In Stock", status: "Active", lastUpdated: daysFromNow(-20) },
    { id: "p2", name: "Hyaluronic Acid Serum 30ml", category: "Cosmetic Products", description: "2% HA serum with panthenol and ceramide complex for intense hydration.", price: "₱480–560/unit", availability: "Low Stock", status: "Active", lastUpdated: daysFromNow(-8) },
    { id: "p3", name: "Matte Lipstick Trio", category: "Cosmetic Products", description: "Long-lasting matte lipstick set in nude, rose, and plum shades.", price: "₱290–340/unit", availability: "In Stock", status: "Active", lastUpdated: daysFromNow(-45) },
    { id: "p4", name: "Refreshing Facial Mist", category: "Cosmetic Products", description: "Hydrating face mist with green tea extract, 100ml spray bottle.", price: "₱180–220/unit", availability: "Made to Order", status: "Pending Review", lastUpdated: daysFromNow(-3) },
  ],
  documents: [
    { type: "Business Registration", fileName: "beautyph_bir.pdf" },
    { type: "Tax Registration", fileName: "beautyph_tin.pdf" },
    { type: "Business Permit", fileName: "beautyph_permit.pdf" },
    { type: "Product Catalog", fileName: "beautyph_catalog.pdf" },
    { type: "Price List", fileName: "beautyph_pricelist.pdf" },
  ],
};

function seedPortalData(): PortalData {
  const orders: PurchaseOrder[] = [
    { id: genId("PO"), orderDate: daysFromNow(-58), expectedDelivery: daysFromNow(-44).slice(0, 10), status: "completed", total: "₱95,000.00", items: [{ productName: "Korean BB Cream SPF 50+", qty: "200", unit: "units" }] },
    { id: genId("PO"), orderDate: daysFromNow(-40), expectedDelivery: daysFromNow(-28).slice(0, 10), status: "completed", total: "₱78,500.00", items: [{ productName: "Korean BB Cream SPF 50+", qty: "150", unit: "units" }, { productName: "Hyaluronic Acid Serum 30ml", qty: "80", unit: "units" }] },
    { id: genId("PO"), orderDate: daysFromNow(-18), expectedDelivery: daysFromNow(-6).slice(0, 10), status: "completed", total: "₱64,200.00", items: [{ productName: "Matte Lipstick Trio", qty: "120", unit: "units" }] },
    { id: genId("PO"), orderDate: daysFromNow(-9), expectedDelivery: daysFromNow(3).slice(0, 10), status: "ready", total: "₱52,800.00", items: [{ productName: "Hyaluronic Acid Serum 30ml", qty: "90", unit: "units" }] },
    { id: genId("PO"), orderDate: daysFromNow(-5), expectedDelivery: daysFromNow(6).slice(0, 10), status: "processing", total: "₱81,000.00", items: [{ productName: "Korean BB Cream SPF 50+", qty: "220", unit: "units" }] },
    { id: genId("PO"), orderDate: daysFromNow(-2), expectedDelivery: daysFromNow(9).slice(0, 10), status: "confirmed", total: "₱43,500.00", items: [{ productName: "Matte Lipstick Trio", qty: "100", unit: "units" }] },
    { id: genId("PO"), orderDate: daysFromNow(-1), expectedDelivery: daysFromNow(12).slice(0, 10), status: "pending", total: "₱37,200.00", items: [{ productName: "Refreshing Facial Mist", qty: "140", unit: "units" }] },
  ];

  const deliveries: Delivery[] = [
    { id: genId("DEL"), poId: orders[0].id, deliveryDate: daysFromNow(-44).slice(0, 10), expectedDelivery: daysFromNow(-44).slice(0, 10), deliveryStatus: "completed", fulfillmentStatus: "Fulfilled", carrier: "LBC Freight", trackingNo: "LBC" + Math.floor(100000 + Math.random() * 900000), notes: "Delivered to Tri-M warehouse, Metro Manila." },
    { id: genId("DEL"), poId: orders[1].id, deliveryDate: daysFromNow(-28).slice(0, 10), expectedDelivery: daysFromNow(-28).slice(0, 10), deliveryStatus: "completed", fulfillmentStatus: "Fulfilled", carrier: "J&T Express", trackingNo: "JNT" + Math.floor(100000 + Math.random() * 900000), notes: "Signed receipt on file." },
    { id: genId("DEL"), poId: orders[2].id, deliveryDate: daysFromNow(-6).slice(0, 10), expectedDelivery: daysFromNow(-6).slice(0, 10), deliveryStatus: "delivered", fulfillmentStatus: "Delivered", carrier: "Own Fleet", trackingNo: "TRM" + Math.floor(100000 + Math.random() * 900000), notes: "Received by Tri-M distribution hub." },
    { id: genId("DEL"), poId: orders[3].id, deliveryDate: daysFromNow(3).slice(0, 10), expectedDelivery: daysFromNow(3).slice(0, 10), deliveryStatus: "shipped", fulfillmentStatus: "In Transit", carrier: "LBC Freight", trackingNo: "LBC" + Math.floor(100000 + Math.random() * 900000), notes: "Out for delivery to Tri-M." },
    { id: genId("DEL"), poId: orders[4].id, deliveryDate: daysFromNow(6).slice(0, 10), expectedDelivery: daysFromNow(6).slice(0, 10), deliveryStatus: "processing", fulfillmentStatus: "Preparing", carrier: "", trackingNo: "", notes: "Picking and packing in progress." },
    { id: genId("DEL"), poId: orders[5].id, deliveryDate: daysFromNow(9).slice(0, 10), expectedDelivery: daysFromNow(9).slice(0, 10), deliveryStatus: "pending", fulfillmentStatus: "Scheduled", carrier: "", trackingNo: "", notes: "Awaiting confirmation." },
  ];

  const transactions: Transaction[] = [
    { id: genId("TXN"), poId: orders[0].id, date: daysFromNow(-58), products: "Korean BB Cream SPF 50+", amount: "₱95,000.00", deliveryStatus: "Completed", transactionStatus: "Completed" },
    { id: genId("TXN"), poId: orders[0].id, date: daysFromNow(-44), products: "Korean BB Cream SPF 50+", amount: "—", deliveryStatus: "Completed", transactionStatus: "Completed" },
    { id: genId("TXN"), poId: orders[1].id, date: daysFromNow(-40), products: "Korean BB Cream SPF 50+, Hyaluronic Acid Serum 30ml", amount: "₱78,500.00", deliveryStatus: "Completed", transactionStatus: "Completed" },
    { id: genId("TXN"), poId: orders[2].id, date: daysFromNow(-18), products: "Matte Lipstick Trio", amount: "₱64,200.00", deliveryStatus: "Completed", transactionStatus: "Completed" },
    { id: genId("TXN"), poId: orders[3].id, date: daysFromNow(-9), products: "Hyaluronic Acid Serum 30ml", amount: "₱52,800.00", deliveryStatus: "Shipped", transactionStatus: "Pending" },
    { id: genId("TXN"), poId: orders[4].id, date: daysFromNow(-5), products: "Korean BB Cream SPF 50+", amount: "₱81,000.00", deliveryStatus: "Processing", transactionStatus: "Pending" },
    { id: genId("TXN"), poId: orders[5].id, date: daysFromNow(-2), products: "Matte Lipstick Trio", amount: "₱43,500.00", deliveryStatus: "Confirmed", transactionStatus: "Pending" },
    { id: genId("TXN"), poId: orders[6].id, date: daysFromNow(-1), products: "Refreshing Facial Mist", amount: "₱37,200.00", deliveryStatus: "Pending", transactionStatus: "Pending" },
  ];

  const notifications: AppNotification[] = [
    { id: genId("N"), title: "New Purchase Order", message: `Purchase Order ${orders[6].id} has been issued for Refreshing Facial Mist.`, type: "purchase_order", read: false, timestamp: daysFromNow(-1) },
    { id: genId("N"), title: "Purchase Order Confirmed", message: `PO ${orders[5].id} (Matte Lipstick Trio) has been confirmed by Tri-M.`, type: "po_update", read: false, timestamp: daysFromNow(-2) },
    { id: genId("N"), title: "Delivery Shipped", message: `Delivery ${deliveries[3].id} for PO ${orders[3].id} is now in transit.`, type: "delivery", read: false, timestamp: daysFromNow(-1) },
    { id: genId("N"), title: "Performance Evaluation Published", message: "Your Q2 2025 performance evaluation is now available (Score: 87).", type: "performance", read: true, timestamp: daysFromNow(-12) },
    { id: genId("N"), title: "Transaction Settled", message: `Payment for PO ${orders[2].id} (₱64,200.00) has been settled.`, type: "transaction", read: true, timestamp: daysFromNow(-16) },
    { id: genId("N"), title: "Supplier Announcement", message: "Tri-M will observe a holiday on the 1st; plan deliveries accordingly.", type: "announcement", read: true, timestamp: daysFromNow(-25) },
  ];

  const evaluations: Evaluation[] = [
    { id: genId("EV"), period: "Q2 2025", date: daysFromNow(-12), score: 87, rating: 4.2, note: "Consistent quality and reliable deliveries." },
    { id: genId("EV"), period: "Q1 2025", date: daysFromNow(-102), score: 84, rating: 4.0, note: "Improved lead times vs previous quarter." },
    { id: genId("EV"), period: "Q4 2024", date: daysFromNow(-193), score: 82, rating: 3.9, note: "Strong product quality; minor delivery delays." },
  ];

  return { supplier: SAMPLE_SUPPLIER, orders, deliveries, transactions, notifications, evaluations };
}

const PORTAL_KEY = "trim_vendor_portal_data";

function loadPortalData(): PortalData {
  try {
    const raw = localStorage.getItem(PORTAL_KEY);
    if (raw) return JSON.parse(raw) as PortalData;
  } catch { /* ignore */ }
  const seeded = seedPortalData();
  try { localStorage.setItem(PORTAL_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
  return seeded;
}

function usePortalData() {
  const [data, setData] = React.useState<PortalData>(() => loadPortalData());
  const update = React.useCallback((next: PortalData) => {
    setData(next);
    try { localStorage.setItem(PORTAL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  return [data, update] as const;
}

// ─────────────────────────────────────────────────────────
// SUPPLIER LOGIN
// ─────────────────────────────────────────────────────────

export const SupplierLogin = ({ onLogin }: { onLogin: (id: string) => void }) => {
  const [supId, setSupId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const ok = supId.trim().toLowerCase() === SAMPLE_SUPPLIER.id.toLowerCase() &&
      (email.trim().toLowerCase() === SAMPLE_SUPPLIER.email.toLowerCase() || email.trim().toLowerCase() === SAMPLE_SUPPLIER.contactEmail?.toLowerCase());
    if (!ok) {
      setError("No approved supplier found for the provided Supplier ID and email. Portal access is limited to approved suppliers.");
      return;
    }
    onLogin(SAMPLE_SUPPLIER.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2e1065] to-[#5b21b6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Boxes size={28} className="text-violet-300" />
          </div>
          <h1 className="text-xl font-bold text-white">Tri-M Supplier Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Vendor / Supplier Access</p>
        </div>

        <div className="surface !rounded-2xl p-7 shadow-2xl bg-white">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sign In</h2>
          <p className="text-xs text-slate-500 mb-6">For approved Tri-M suppliers only.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Supplier ID">
              <input className={inp} value={supId} onChange={e => { setSupId(e.target.value); setError(""); }}
                placeholder="e.g. SUP-2024-10001" autoComplete="username" />
            </Field>
            <Field label="Company / Contact Email">
              <input type="email" className={inp} value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                placeholder="you@company.com" autoComplete="email" />
            </Field>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}
            <Btn type="submit" disabled={!supId || !email} className="w-full">
              <LogOut size={15} className="rotate-180" /> Sign In to Portal
            </Btn>
          </form>

          <div className="mt-5 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Demo Approved Supplier</p>
            <button onClick={() => onLogin(SAMPLE_SUPPLIER.id)}
              className="text-xs text-violet-600 font-mono hover:underline">{SAMPLE_SUPPLIER.id} · Sign in as demo</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// ACCESS DENIED
// ─────────────────────────────────────────────────────────

export const SupplierAccessDenied = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-[#2e1065] to-[#5b21b6] flex items-center justify-center p-4">
    <div className="w-full max-w-md text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-5">
        <ShieldCheck size={30} className="text-violet-300" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Supplier Portal Access Restricted</h1>
      <p className="text-sm text-slate-300 leading-relaxed mb-6">
        Only approved and active suppliers can access the Vendor/Supplier Portal. If you believe this is an error, please contact your Tri-M procurement representative.
      </p>
      <Btn variant="secondary" onClick={onBack} className="!bg-white !text-[#2e1065] hover:!bg-violet-50">Back</Btn>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────

const SupplierDashboard = ({ data, onNav }: { data: PortalData; onNav: (p: SubPage) => void }) => {
  const { supplier, orders, deliveries, transactions, notifications, evaluations } = data;
  const activeOrders = orders.filter(o => ["pending", "confirmed", "processing", "ready"].includes(o.status)).length;
  const pendingDeliveries = deliveries.filter(d => ["pending", "processing", "shipped"].includes(d.deliveryStatus)).length;
  const completedTxns = transactions.filter(t => t.transactionStatus === "Completed").length;

  const recentOrders = orders.slice().sort((a, b) => +new Date(b.orderDate) - +new Date(a.orderDate)).slice(0, 4);
  const upcomingDeliveries = deliveries
    .filter(d => !["completed", "delivered"].includes(d.deliveryStatus))
    .sort((a, b) => +new Date(a.expectedDelivery) - +new Date(b.expectedDelivery)).slice(0, 4);

  const recentActivity = [
    ...orders.slice().sort((a, b) => +new Date(b.orderDate) - +new Date(a.orderDate)).slice(0, 2).map(o => ({ key: o.id, icon: <ShoppingCart size={14} />, title: `Purchase Order ${o.id}`, sub: `${PO_STATUS[o.status].label} · ${o.total}`, date: o.orderDate })),
    ...deliveries.slice().sort((a, b) => +new Date(b.expectedDelivery) - +new Date(a.expectedDelivery)).slice(0, 2).map(d => ({ key: d.id, icon: <Truck size={14} />, title: `Delivery ${d.id}`, sub: `${DELIVERY_STATUS[d.deliveryStatus].label}`, date: d.expectedDelivery })),
    ...notifications.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 2).map(n => ({ key: n.id, icon: NOTIF_META[n.type].icon, title: n.title, sub: n.message, date: n.timestamp })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5);

  const trend = evaluations.map(e => e.score);
  const maxScore = Math.max(100, ...trend);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#5b21b6] text-white flex items-center justify-center shrink-0"><Building2 size={24} /></div>
            <div>
              <h1 className="text-[clamp(1.125rem,1.02rem+0.5vw,1.4rem)] font-bold text-slate-800 tracking-tight">Welcome back, {supplier.companyName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <MonoId id={supplier.id} />
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {supplier.status === "Active" ? "Active" : "Inactive"} Supplier
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={<Package size={20} className="text-violet-600" />} label="Products Supplied" value={supplier.products.length} color="bg-violet-50" />
        <KpiCard icon={<ShoppingCart size={20} className="text-sky-600" />} label="Active Purchase Orders" value={activeOrders} color="bg-sky-50" />
        <KpiCard icon={<Truck size={20} className="text-amber-600" />} label="Pending Deliveries" value={pendingDeliveries} color="bg-amber-50" />
        <KpiCard icon={<History size={20} className="text-green-600" />} label="Completed Transactions" value={completedTxns} color="bg-green-50" />
        <KpiCard icon={<Award size={20} className="text-indigo-600" />} label="Performance Score" value={supplier.evaluationScore} color="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Purchase Orders */}
        <Card className="p-5">
          <SectionHeader icon={<ShoppingCart size={18} />} title="Recent Purchase Orders"
            action={<button onClick={() => onNav("orders")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 shrink-0">View all <ChevronRight size={13} /></button>} />
          <div className="space-y-2">
            {recentOrders.map(o => (
              <button key={o.id} onClick={() => onNav("orders")} className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/40 transition-colors text-left">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700"><MonoId id={o.id} /></p>
                  <p className="text-xs text-slate-400 truncate">{o.items.map(i => i.productName).join(", ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusPill cfg={PO_STATUS[o.status]} />
                  <span className="text-[11px] text-slate-400">{fmtDate(o.orderDate)}</span>
                </div>
              </button>
            ))}
            {recentOrders.length === 0 && <p className="text-xs text-slate-400">No purchase orders yet.</p>}
          </div>
        </Card>

        {/* Upcoming Deliveries */}
        <Card className="p-5">
          <SectionHeader icon={<Truck size={18} />} title="Upcoming Deliveries"
            action={<button onClick={() => onNav("delivery")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 shrink-0">View all <ChevronRight size={13} /></button>} />
          <div className="space-y-3">
            {upcomingDeliveries.map(d => (
              <button key={d.id} onClick={() => onNav("delivery")} className="w-full text-left block">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700"><MonoId id={d.id} /></p>
                    <p className="text-xs text-slate-400">PO <MonoId id={d.poId} /></p>
                  </div>
                  <StatusPill cfg={DELIVERY_STATUS[d.deliveryStatus]} />
                </div>
                <Stepper steps={DELIVERY_STEPS} current={d.deliveryStatus} />
                <p className="text-[11px] text-slate-400 mt-1.5">Expected {fmtDate(d.expectedDelivery)}</p>
              </button>
            ))}
            {upcomingDeliveries.length === 0 && <p className="text-xs text-slate-400">No upcoming deliveries.</p>}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-5">
          <SectionHeader icon={<Clock size={18} />} title="Recent Activity" />
          <div className="space-y-1">
            {recentActivity.map(a => (
              <div key={a.key} className="flex gap-3 py-2.5 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">{a.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{a.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{a.sub}</p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(a.date)}</span>
              </div>
            ))}
            {recentActivity.length === 0 && <p className="text-xs text-slate-400">No recent activity.</p>}
          </div>
        </Card>

        {/* Performance Overview */}
        <Card className="p-5 flex flex-col">
          <SectionHeader icon={<TrendingUp size={18} />} title="Performance Overview" />
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-3xl font-bold text-[#5b21b6] leading-none">{supplier.evaluationScore}</p>
                <p className="text-xs text-slate-400 mt-1.5">Overall Score</p>
              </div>
              <div className="mt-1"><Stars rating={supplier.performanceRating} /></div>
            </div>
            <div className="flex-1 flex items-end gap-2.5 sm:gap-3 h-28">
              {trend.map((s, i) => (
                <div key={i} className="flex-1 h-full flex items-end rounded-t bg-slate-50 overflow-hidden" title={`${s}`}>
                  <div className="w-full rounded-t bg-gradient-to-t from-violet-500 to-violet-400" style={{ height: `${(s / maxScore) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => onNav("performance")} className="mt-4 text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 self-start">
            View Performance <ChevronRight size={13} />
          </button>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// COMPANY PROFILE
// ─────────────────────────────────────────────────────────

const SupplierProfile = ({ data, onSave }: { data: PortalData; onSave: (patch: Partial<Supplier>) => void }) => {
  const { supplier } = data;
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(() => ({ ...supplier }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = (k: keyof Supplier, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = "Company name is required.";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email is required.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    if (!form.address.trim()) e.address = "Address is required.";
    if (!form.contactName.trim()) e.contactName = "Contact name is required.";
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({
      companyName: form.companyName, address: form.address, email: form.email, phone: form.phone,
      website: form.website, contactName: form.contactName, contactPosition: form.contactPosition,
      contactEmail: form.contactEmail, contactPhone: form.contactPhone,
      supplierType: form.supplierType, yearsInBusiness: form.yearsInBusiness, distributionArea: form.distributionArea,
      paymentTerms: form.paymentTerms, leadTime: form.leadTime, deliveryCapability: form.deliveryCapability,
    });
    setEditing(false);
  };

  const DocRow = ({ doc }: { doc: { type: string; fileName: string } }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
      <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><FileText size={16} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 truncate">{doc.type}</p>
        <p className="text-xs text-slate-400 truncate">{doc.fileName}</p>
      </div>
      <button className="text-xs font-semibold text-violet-600 hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50 shrink-0" title="View"><Eye size={13} /></button>
    </div>
  );

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-3">
      <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr] sm:gap-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold pt-1">{label}</p>
        <div className="text-sm text-slate-700 break-words">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!editing && (
          <Btn size="sm" onClick={() => { setForm({ ...supplier }); setErrors({}); setEditing(true); }}>
            <Pencil size={13} /> Edit Profile
          </Btn>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-700">
          <Info size={14} className="shrink-0" /> You are editing your profile. Save to update your records.
        </div>
      )}

      <Card className="p-5 sm:p-6">
        <SectionHeader icon={<Building2 size={18} />} title="Company Information" />
        <div className="divide-y divide-slate-50">
          <InfoRow icon={<Building2 size={15} />} label="Company Name" value={editing ? <input className={inp} value={form.companyName} onChange={e => set("companyName", e.target.value)} /> : supplier.companyName} />
          <InfoRow icon={<ClipboardList size={15} />} label="Supplier ID" value={<MonoId id={supplier.id} />} />
          <InfoRow icon={<Package size={15} />} label="Business Type" value={editing ? <input className={inp} value={form.supplierType} onChange={e => set("supplierType", e.target.value)} /> : supplier.supplierType} />
          <InfoRow icon={<MapPin size={15} />} label="Business Address" value={editing ? <textarea className={`${inp} resize-none`} rows={2} value={form.address} onChange={e => set("address", e.target.value)} /> : supplier.address} />
          <InfoRow icon={<Mail size={15} />} label="Email" value={editing ? <input className={inp} value={form.email} onChange={e => set("email", e.target.value)} /> : supplier.email} />
          <InfoRow icon={<Globe size={15} />} label="Website" value={editing ? <input className={inp} value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.company.com" /> : (supplier.website || "—")} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHeader icon={<Users size={18} />} title="Contact Information" />
        <div className="divide-y divide-slate-50">
          <InfoRow icon={<Users size={15} />} label="Contact Person" value={editing ? <input className={inp} value={form.contactName} onChange={e => set("contactName", e.target.value)} /> : supplier.contactName} />
          <InfoRow icon={<Briefcase size={15} />} label="Position" value={editing ? <input className={inp} value={form.contactPosition} onChange={e => set("contactPosition", e.target.value)} /> : supplier.contactPosition} />
          <InfoRow icon={<Mail size={15} />} label="Contact Email" value={editing ? <input className={inp} value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} /> : supplier.contactEmail} />
          <InfoRow icon={<Phone size={15} />} label="Contact Phone" value={editing ? <input className={inp} value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} /> : supplier.contactPhone} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHeader icon={<Briefcase size={18} />} title="Business Information" />
        <div className="divide-y divide-slate-50">
          <InfoRow icon={<Clock size={15} />} label="Years in Business" value={editing ? <input className={inp} value={form.yearsInBusiness} onChange={e => set("yearsInBusiness", e.target.value)} /> : supplier.yearsInBusiness} />
          <InfoRow icon={<MapPin size={15} />} label="Distribution Area" value={editing ? <input className={inp} value={form.distributionArea} onChange={e => set("distributionArea", e.target.value)} /> : supplier.distributionArea} />
          <InfoRow icon={<ClipboardList size={15} />} label="Payment Terms" value={editing ? <input className={inp} value={form.paymentTerms} onChange={e => set("paymentTerms", e.target.value)} /> : supplier.paymentTerms} />
          <InfoRow icon={<Truck size={15} />} label="Lead Time" value={editing ? <input className={inp} value={form.leadTime} onChange={e => set("leadTime", e.target.value)} /> : supplier.leadTime} />
          <InfoRow icon={<Truck size={15} />} label="Delivery Capability" value={editing ? <textarea className={`${inp} resize-none`} rows={2} value={form.deliveryCapability} onChange={e => set("deliveryCapability", e.target.value)} /> : supplier.deliveryCapability} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHeader icon={<FileText size={18} />} title="Business Documents" subtitle="Submitted during onboarding (view only)" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {supplier.documents.map((d, i) => <DocRow key={i} doc={d} />)}
        </div>
      </Card>

      {editing && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Btn variant="secondary" onClick={() => { setEditing(false); setErrors({}); }}>Cancel</Btn>
          <Btn onClick={handleSave}><Save size={14} /> Save Changes</Btn>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// PRODUCTS SUPPLIED
// ─────────────────────────────────────────────────────────

const SupplierProducts = ({ data, onSave }: { data: PortalData; onSave: (products: Product[]) => void }) => {
  const [products, setProducts] = React.useState<Product[]>(() => data.supplier.products.map(p => ({ ...p })));
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const setProduct = (id: string, k: keyof Product, v: string) =>
    setProducts(ps => ps.map(p => p.id === id ? { ...p, [k]: v } : p));

  const addProduct = () => {
    const np: Product = { id: Math.random().toString(36).slice(2), name: "", category: "", description: "", price: "", availability: "Made to Order", status: "Pending Review", lastUpdated: now() };
    setProducts(ps => [...ps, np]);
    setEditingId(np.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Btn size="sm" onClick={addProduct}><Plus size={13} /> Add Product</Btn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {products.map(p => {
          const editing = editingId === p.id;
          return (
            <Card key={p.id} className="p-5 card-hover">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{p.name || "New Product"}</p>
                  <p className="text-xs text-slate-400">{p.category || "Uncategorized"}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border shrink-0 ${p.status === "Active" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {p.status === "Active" ? <CheckCircle size={12} /> : <Clock size={12} />}{p.status}
                </span>
              </div>

              {editing ? (
                <div className="space-y-3">
                  <Field label="Product Name"><input className={inp} value={p.name} onChange={e => setProduct(p.id, "name", e.target.value)} placeholder="Product name" /></Field>
                  <Field label="Category">
                    <div className="relative">
                      <select className={selectCls} value={p.category} onChange={e => setProduct(p.id, "category", e.target.value)}>
                        <option value="">Select category</option>
                        {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Price / Agreed Price"><input className={inp} value={p.price} onChange={e => setProduct(p.id, "price", e.target.value)} placeholder="₱/unit" /></Field>
                    <Field label="Availability">
                      <div className="relative">
                        <select className={selectCls} value={p.availability} onChange={e => setProduct(p.id, "availability", e.target.value as Product["availability"])}>
                          {(["In Stock", "Low Stock", "Out of Stock", "Made to Order"] as const).map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </Field>
                  </div>
                  <Field label="Description"><textarea className={`${inp} resize-none`} rows={2} value={p.description} onChange={e => setProduct(p.id, "description", e.target.value)} placeholder="Description" /></Field>
                  <div className="flex gap-2 justify-end">
                    <Btn size="sm" variant="secondary" onClick={() => setEditingId(null)}>Done</Btn>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">{p.description || "No description provided."}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2.5"><p className="text-slate-400">Price</p><p className="font-semibold text-slate-700">{p.price || "—"}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2.5"><p className="text-slate-400">Availability</p><p className="font-semibold text-slate-700">{p.availability}</p></div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-400">Updated {fmtDate(p.lastUpdated)}</p>
                    <button onClick={() => setEditingId(p.id)} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                      <Pencil size={12} /> Update
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {products.length === 0 && <Card className="p-10 text-center col-span-full"><Package size={32} className="text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No products supplied yet. Add one to get started.</p></Card>}
      </div>

      <div className="flex justify-end">
        <Btn onClick={() => { products.forEach(p => p.lastUpdated = now()); onSave(products); setEditingId(null); }}>
          <Save size={14} /> Save Products
        </Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// PURCHASE ORDERS
// ─────────────────────────────────────────────────────────

const SupplierOrders = ({ data, setData }: { data: PortalData; setData: (n: PortalData) => void }) => {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<POStatus | "">("");
  const [selected, setSelected] = React.useState<PurchaseOrder | null>(null);

  const filtered = data.orders
    .filter(o => {
      const q = search.toLowerCase();
      const matchSearch = !q || o.id.toLowerCase().includes(q) || o.items.some(i => i.productName.toLowerCase().includes(q));
      const matchStatus = !statusFilter || o.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => +new Date(b.orderDate) - +new Date(a.orderDate));

  const advance = (id: string) => {
    setData({
      ...data,
      orders: data.orders.map(o => {
        if (o.id !== id) return o;
        const next = PO_NEXT[o.status];
        return next ? { ...o, status: next.next } : o;
      }),
    });
    setSelected(prev => prev ? { ...prev, status: PO_NEXT[prev.status]?.next ?? prev.status } : prev);
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search PO number or product…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative sm:w-56">
            <select className={selectCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value as POStatus | "")}>
              <option value="">All statuses</option>
              {Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(o => {
          const next = PO_NEXT[o.status];
          return (
            <Card key={o.id} className="p-5 card-hover cursor-pointer hover:border-violet-300 transition-colors" onClick={() => setSelected(o)}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><ShoppingCart size={18} /></div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800"><MonoId id={o.id} /></p>
                    <p className="text-xs text-slate-400">Ordered {fmtDate(o.orderDate)}</p>
                  </div>
                </div>
                <StatusPill cfg={PO_STATUS[o.status]} />
              </div>
              <p className="text-xs text-slate-500 mb-2.5 truncate">{o.items.map(i => `${i.qty} ${i.unit} ${i.productName}`).join(" · ")}</p>
              <Stepper steps={PO_STEPS} current={o.status} />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-500">Total <strong className="text-slate-700">{o.total}</strong></span>
                {next && (
                  <Btn size="sm" onClick={(e) => { e.stopPropagation(); advance(o.id); }}>
                    <CheckCircle2 size={12} /> {next.label}
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-10 text-center col-span-full"><p className="text-sm text-slate-400">No purchase orders match your filters.</p></Card>}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Purchase Order ${selected?.id ?? ""}`}
        footer={selected && PO_NEXT[selected.status] && (
          <Btn className="w-full" onClick={() => advance(selected.id)}>
            <CheckCircle2 size={14} /> {PO_NEXT[selected.status]!.label}
          </Btn>
        )}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusPill cfg={PO_STATUS[selected.status]} />
              <span className="text-xs text-slate-500">Ordered {fmtDate(selected.orderDate)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400">Expected Delivery</p><p className="font-semibold text-slate-700">{fmtDate(selected.expectedDelivery)}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400">Total</p><p className="font-semibold text-slate-700">{selected.total}</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items</p>
              <TableScroll>
                <table className="w-full min-w-[300px]">
                  <thead><tr className="text-xs font-bold text-slate-500 border-b border-slate-100 bg-slate-50/60"><th className="text-left px-3 py-2">Product</th><th className="text-left px-3 py-2">Qty</th></tr></thead>
                  <tbody>
                    {selected.items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-sm text-slate-700">{it.productName}</td>
                        <td className="px-3 py-2 text-sm text-slate-600">{it.qty} {it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// DELIVERY / FULFILLMENT
// ─────────────────────────────────────────────────────────

const SupplierDelivery = ({ data, setData }: { data: PortalData; setData: (n: PortalData) => void }) => {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<DeliveryStatus | "">("");
  const [editing, setEditing] = React.useState<Delivery | null>(null);

  const filtered = data.deliveries
    .filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.id.toLowerCase().includes(q) || d.poId.toLowerCase().includes(q) || d.carrier.toLowerCase().includes(q);
      const matchStatus = !statusFilter || d.deliveryStatus === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => +new Date(b.expectedDelivery) - +new Date(a.expectedDelivery));

  const advance = (id: string) => {
    setData({ ...data, deliveries: data.deliveries.map(d => d.id === id ? { ...d, deliveryStatus: DELIVERY_NEXT[d.deliveryStatus] ?? d.deliveryStatus } : d) });
  };

  const save = () => {
    if (!editing) return;
    setData({ ...data, deliveries: data.deliveries.map(d => d.id === editing.id ? editing : d) });
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search delivery or PO…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative sm:w-56">
            <select className={selectCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value as DeliveryStatus | "")}>
              <option value="">All statuses</option>
              {Object.entries(DELIVERY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(d => {
          const next = DELIVERY_NEXT[d.deliveryStatus];
          return (
            <Card key={d.id} className="p-5 card-hover">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><Truck size={16} /></div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm"><MonoId id={d.id} /></p>
                    <p className="text-xs text-slate-400">PO <MonoId id={d.poId} /></p>
                  </div>
                </div>
                <StatusPill cfg={DELIVERY_STATUS[d.deliveryStatus]} />
              </div>

              <Stepper steps={DELIVERY_STEPS} current={d.deliveryStatus} />

              <div className="space-y-1.5 text-xs mt-3 mb-3">
                <div className="flex justify-between"><span className="text-slate-400">Delivery Date</span><span className="font-medium text-slate-700">{fmtDate(d.deliveryDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Expected Delivery</span><span className="font-medium text-slate-700">{fmtDate(d.expectedDelivery)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fulfillment</span><span className="font-medium text-slate-700">{d.fulfillmentStatus}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Carrier</span><span className="font-medium text-slate-700 truncate ml-2">{d.carrier || "—"}</span></div>
              </div>
              {d.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 mb-3">{d.notes}</p>}
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" className="flex-1" onClick={() => setEditing({ ...d })}><Pencil size={12} /> Update</Btn>
                {next && (
                  <Btn size="sm" className="flex-1" onClick={() => advance(d.id)}><CheckCircle2 size={12} /> Advance</Btn>
                )}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-10 text-center col-span-full"><p className="text-sm text-slate-400">No deliveries match your filters.</p></Card>}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Update Delivery ${editing?.id ?? ""}`}
        footer={editing && (
          <div className="flex gap-3 justify-end">
            <Btn variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn size="sm" onClick={save}><Save size={14} /> Save</Btn>
          </div>
        )}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Delivery Status">
              <div className="relative">
                <select className={selectCls} value={editing.deliveryStatus} onChange={e => setEditing({ ...editing, deliveryStatus: e.target.value as DeliveryStatus })}>
                  {Object.entries(DELIVERY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </Field>
            <Field label="Fulfillment Status"><input className={inp} value={editing.fulfillmentStatus} onChange={e => setEditing({ ...editing, fulfillmentStatus: e.target.value })} placeholder="e.g. Preparing" /></Field>
            <Field label="Carrier"><input className={inp} value={editing.carrier} onChange={e => setEditing({ ...editing, carrier: e.target.value })} placeholder="e.g. LBC Freight" /></Field>
            <Field label="Tracking Number"><input className={inp} value={editing.trackingNo} onChange={e => setEditing({ ...editing, trackingNo: e.target.value })} placeholder="Tracking reference" /></Field>
            <Field label="Expected Delivery"><input type="date" className={inp} value={editing.expectedDelivery.slice(0, 10)} onChange={e => setEditing({ ...editing, expectedDelivery: e.target.value })} /></Field>
            <Field label="Actual Delivery Date"><input type="date" className={inp} value={editing.deliveryDate.slice(0, 10)} onChange={e => setEditing({ ...editing, deliveryDate: e.target.value })} /></Field>
            <Field label="Notes"><textarea className={`${inp} resize-none`} rows={2} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Delivery notes / remarks" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// TRANSACTION HISTORY
// ─────────────────────────────────────────────────────────

const SupplierTransactions = ({ data }: { data: PortalData }) => {
  const [search, setSearch] = React.useState("");
  const [txnFilter, setTxnFilter] = React.useState<TxnStatus | "">("");
  const [deliveryFilter, setDeliveryFilter] = React.useState<string>("");
  const [sort, setSort] = React.useState<"date_desc" | "date_asc" | "amount_desc">("date_desc");

  const amountNum = (a: string) => Number(a.replace(/[^\d.]/g, "")) || 0;

  const filtered = data.transactions
    .filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q || t.id.toLowerCase().includes(q) || t.poId.toLowerCase().includes(q) || t.products.toLowerCase().includes(q);
      const matchTxn = !txnFilter || t.transactionStatus === txnFilter;
      const matchDel = !deliveryFilter || t.deliveryStatus === deliveryFilter;
      return matchSearch && matchTxn && matchDel;
    })
    .sort((a, b) => {
      if (sort === "date_asc") return +new Date(a.date) - +new Date(b.date);
      if (sort === "amount_desc") return amountNum(b.amount) - amountNum(a.amount);
      return +new Date(b.date) - +new Date(a.date);
    });

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search transactions…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative lg:w-48">
            <select className={selectCls} value={txnFilter} onChange={e => setTxnFilter(e.target.value as TxnStatus | "")}>
              <option value="">All Txn Status</option>
              {(["Completed", "Pending"] as TxnStatus[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative lg:w-48">
            <select className={selectCls} value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)}>
              <option value="">All Delivery Status</option>
              {["Pending", "Confirmed", "Processing", "Shipped", "Completed"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative lg:w-44">
            <select className={selectCls} value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Amount (high→low)</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      <Card>
        <TableScroll>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3">Transaction ID</th>
                <th className="text-left px-4 py-3">Purchase Order</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Products</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Delivery Status</th>
                <th className="text-left px-4 py-3">Transaction Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3"><MonoId id={t.id} /></td>
                  <td className="px-4 py-3"><MonoId id={t.poId} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{t.products}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{t.amount}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{t.deliveryStatus}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${TXN_STATUS[t.transactionStatus].cls}`}>{t.transactionStatus}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">No transactions match your search.</td></tr>}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// PERFORMANCE
// ─────────────────────────────────────────────────────────

const SupplierPerformance = ({ data }: { data: PortalData }) => {
  const { supplier, deliveries, evaluations } = data;
  const score = supplier.evaluationScore;
  const rating = supplier.performanceRating;

  const delivered = deliveries.filter(d => d.deliveryStatus === "delivered" || d.deliveryStatus === "completed").length;
  const onTime = deliveries.filter(d => (d.deliveryStatus === "delivered" || d.deliveryStatus === "completed") && d.deliveryDate <= d.expectedDelivery).length;
  const deliveryPerf = delivered > 0 ? Math.round((onTime / delivered) * 100) : 0;
  const productQuality = Math.min(100, Math.round(score * 0.95));
  const orderFulfillment = Math.min(100, Math.round((delivered / Math.max(1, deliveries.length)) * 100));

  const trend = evaluations.map(e => ({ period: e.period, score: e.score }));
  const maxScore = Math.max(100, ...trend.map(t => t.score));

  const bars = [
    { label: "Delivery Performance", value: deliveryPerf, color: "bg-green-500" },
    { label: "Product Quality", value: productQuality, color: "bg-violet-500" },
    { label: "Fulfillment Rate", value: orderFulfillment, color: "bg-sky-500" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Your evaluation by Tri-M. Scores are set by Tri-M and cannot be edited here.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Overall Score</p><p className="text-3xl font-bold text-[#5b21b6] mt-1">{score}</p><p className="text-xs text-slate-400 mt-0.5">Tri-M evaluation</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rating</p><div className="mt-1.5"><Stars rating={rating} /></div><p className="text-xs text-slate-400 mt-0.5">Average rating</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Delivery Performance</p><p className="text-3xl font-bold text-green-600 mt-1">{deliveryPerf}%</p><p className="text-xs text-slate-400 mt-0.5">On-time rate</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fulfillment Rate</p><p className="text-3xl font-bold text-sky-600 mt-1">{orderFulfillment}%</p><p className="text-xs text-slate-400 mt-0.5">Fulfilled orders</p></Card>
      </div>

      <Card className="p-5">
        <SectionHeader icon={<TrendingUp size={18} />} title="Performance Trend" subtitle="Evaluation score over periods" />
        <div className="flex items-end gap-2 sm:gap-4 h-48 px-1">
          {trend.map(t => (
            <div key={t.period} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs font-semibold text-slate-600 mb-1">{t.score}</span>
              <div className="w-full rounded-t-lg bg-gradient-to-t from-violet-500 to-violet-400" style={{ height: `${(t.score / maxScore) * 100}%` }} />
              <span className="text-[11px] text-slate-400 mt-1.5">{t.period}</span>
            </div>
          ))}
          {trend.length === 0 && <p className="text-sm text-slate-400">No trend data yet.</p>}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {bars.map(b => (
          <Card key={b.label} className="p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{b.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{b.value}%</p>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2.5"><div className={`h-full ${b.color}`} style={{ width: `${b.value}%` }} /></div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <SectionHeader icon={<ClipboardList size={18} />} title="Evaluation History" subtitle="Past Tri-M evaluations" />
        <div className="space-y-3">
          {evaluations.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">{e.score}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700">{e.period} <span className="text-xs font-normal text-slate-400">· {fmtDate(e.date)}</span></p>
                <p className="text-xs text-slate-500 truncate">{e.note}</p>
              </div>
              <div className="shrink-0"><Stars rating={e.rating} /></div>
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">Your performance score and ratings are determined by Tri-M Global Logistics &amp; Trading Inc. and are read-only in this portal.</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────

const SupplierNotifications = ({ data, setData, onNav }: { data: PortalData; setData: (n: PortalData) => void; onNav: (p: SubPage) => void }) => {
  const [filter, setFilter] = React.useState<NotifType | "">("");

  const filtered = data.notifications
    .filter(n => !filter || n.type === filter)
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  const markRead = (id: string) => setData({ ...data, notifications: data.notifications.map(n => n.id === id ? { ...n, read: true } : n) });
  const markAll = () => setData({ ...data, notifications: data.notifications.map(n => ({ ...n, read: true })) });
  const unread = data.notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {unread > 0 && (
          <Btn size="sm" variant="secondary" onClick={markAll}><CheckCircle2 size={13} /> Mark all read</Btn>
        )}
      </div>
      <p className="text-sm text-slate-500">{unread} unread update{unread === 1 ? "" : "s"}.</p>

      <Card className="p-4">
        <div className="relative">
          <select className={selectCls} value={filter} onChange={e => setFilter(e.target.value as NotifType | "")}>
            <option value="">All notifications</option>
            {Object.entries(NOTIF_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center"><Bell size={36} className="text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">No notifications.</p></Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(n => (
            <div key={n.id} onClick={() => markRead(n.id)}
              className={`p-4 rounded-xl border flex items-start gap-4 transition-all cursor-pointer hover:shadow-sm ${n.read ? "bg-white border-slate-200" : "bg-violet-50/60 border-violet-200"}`}>
              <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${NOTIF_META[n.type].cls}`}>{NOTIF_META[n.type].icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-sm font-semibold ${n.read ? "text-slate-600" : "text-slate-800"}`}>{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onNav("orders")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 px-3 py-2 border border-violet-200 rounded-lg hover:bg-violet-50">View Purchase Orders</button>
        <button onClick={() => onNav("delivery")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 px-3 py-2 border border-violet-200 rounded-lg hover:bg-violet-50">View Deliveries</button>
        <button onClick={() => onNav("performance")} className="text-xs font-semibold text-violet-600 hover:text-violet-800 px-3 py-2 border border-violet-200 rounded-lg hover:bg-violet-50">View Performance</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// PORTAL SHELL
// ─────────────────────────────────────────────────────────

type SubPage = "dashboard" | "profile" | "products" | "orders" | "delivery" | "transactions" | "performance" | "notifications";

const SUP_NAV: { icon: React.ReactNode; label: string; page: SubPage }[] = [
  { icon: <LayoutDashboard size={17} />, label: "Dashboard", page: "dashboard" },
  { icon: <Building2 size={17} />, label: "Company Profile", page: "profile" },
  { icon: <Package size={17} />, label: "Products Supplied", page: "products" },
  { icon: <ShoppingCart size={17} />, label: "Purchase Orders", page: "orders" },
  { icon: <Truck size={17} />, label: "Deliveries / Fulfillment", page: "delivery" },
  { icon: <History size={17} />, label: "Transaction History", page: "transactions" },
  { icon: <Award size={17} />, label: "Performance", page: "performance" },
];

export default function SupplierPortal({ supplierId, onLogout }: { supplierId: string; onLogout: () => void }) {
  const [data, setData] = usePortalData();
  const [sub, setSub] = React.useState<SubPage>("dashboard");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const updateSupplier = (patch: Partial<Supplier>) => setData({ ...data, supplier: { ...data.supplier, ...patch } });
  const updateProducts = (products: Product[]) => setData({ ...data, supplier: { ...data.supplier, products } });

  const unread = data.notifications.filter(n => !n.read).length;

  const Sidebar = ({ mobile = false, collapsed = false, onToggleCollapse }: { mobile?: boolean; collapsed?: boolean; onToggleCollapse?: () => void }) => {
    const isCollapsed = mobile ? false : collapsed;
    return (
      <div className="flex flex-col h-full bg-[#1e0a4a]">
        <div className={`flex items-center gap-2.5 px-4 pt-5 pb-3 ${isCollapsed ? "px-2 justify-center" : ""}`}>
          <div className={`shrink-0 rounded-lg flex items-center justify-center border border-violet-400/30 bg-violet-400/20 ${isCollapsed ? "w-7 h-7" : "w-8 h-8"}`}>
            <Boxes size={isCollapsed ? 15 : 16} className="text-violet-300" />
          </div>
          {!isCollapsed && (
            <div className="text-left leading-tight flex-1 min-w-0">
              <div className="text-xs font-bold text-white tracking-wide">TRI-M SUPPLIER</div>
              <div className="text-[10px] text-slate-400 tracking-wider">VENDOR PORTAL</div>
            </div>
          )}
        </div>

        <nav className={isCollapsed ? "flex-1 overflow-visible py-2 px-2 space-y-1" : "flex-1 overflow-y-auto py-2 px-3 space-y-1"}>
          {SUP_NAV.map(({ icon, label, page }) => (
            <button key={page}
              onClick={() => { setSub(page); setMobileOpen(false); }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${isCollapsed ? "justify-center" : ""} ${sub === page ? "bg-violet-500/20 text-white" : "text-slate-300 hover:text-white hover:bg-white/5"}`}>
              {icon}
              {!isCollapsed && <span className="flex-1">{label}</span>}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">{label}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 pt-2 pb-4 mt-auto space-y-1">
          <button onClick={onLogout}
            className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition-all ${isCollapsed ? "justify-center" : ""}`}>
            <LogOut size={16} />
            {!isCollapsed && <span className="flex-1 text-left">Logout</span>}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">Logout</span>
            )}
          </button>

          {!mobile && (
            <button onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all ${isCollapsed ? "justify-center" : ""}`}>
              {isCollapsed ? (
                <ChevronRight size={16} />
              ) : (
                <>
                  <ChevronLeft size={16} />
                  <span className="flex-1 text-left">Collapse Sidebar</span>
                </>
              )}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">Expand Sidebar</span>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const currentLabel = SUP_NAV.find(n => n.page === sub)?.label ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className={`hidden lg:flex shrink-0 bg-[#1e0a4a] transition-[width] duration-300 ease-in-out relative z-10 ${collapsed ? "w-[76px]" : "w-64"}`}>
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex overflow-hidden">
          <div className="drawer-backdrop absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="drawer-panel relative w-64 max-w-[80%] h-full shadow-2xl bg-[#1e0a4a]">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <header className="bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors shrink-0"><Menu size={20} /></button>
            <h2 className="font-bold text-slate-800 text-sm truncate">{currentLabel}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setSub("notifications")} className="relative p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors" title="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
            </span>
            <MonoId id={data.supplier.id} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div key={sub} className="page-enter mx-auto max-w-[1440px]">
            {sub === "dashboard" && <SupplierDashboard data={data} onNav={setSub} />}
            {sub === "profile" && <SupplierProfile data={data} onSave={updateSupplier} />}
            {sub === "products" && <SupplierProducts data={data} onSave={updateProducts} />}
            {sub === "orders" && <SupplierOrders data={data} setData={setData} />}
            {sub === "delivery" && <SupplierDelivery data={data} setData={setData} />}
            {sub === "transactions" && <SupplierTransactions data={data} />}
            {sub === "performance" && <SupplierPerformance data={data} />}
            {sub === "notifications" && <SupplierNotifications data={data} setData={setData} onNav={setSub} />}
          </div>
        </main>
        <div id="modal-portal" />
      </div>
    </div>
  );
}
