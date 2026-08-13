import { useState, useRef, useEffect, Dispatch, SetStateAction } from "react";
import {
  Building2, Users, FileText, CheckCircle2, XCircle, Clock,
  AlertCircle, Search, Bell, LogOut, Plus, Trash2, Upload,
  Eye, TrendingUp, Award, BarChart2, Package, Menu, X,
  ChevronRight, Star, Calendar, Phone, Mail, Globe, MapPin,
  Shield, Activity, ClipboardList, UserCheck, ArrowLeft,
  Filter, CheckCircle, AlertTriangle, Info, Download,
  RefreshCw, ChevronDown, Briefcase, Lock, FileCheck,
  ChevronUp, Layers, Truck, Boxes, Handshake, ArrowRight, ShieldCheck
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

type Page =
  | "home" | "apply" | "apply-success" | "status"
  | "admin-login" | "admin-vendor" | "admin-review"
  | "admin-suppliers" | "admin-evaluation"
  | "admin-performance" | "admin-notifications" | "admin-audit";

type AppStatus = "pending_review" | "under_review" | "revision_required" | "approved" | "rejected";
type SupplierType = "Manufacturer" | "Distributor" | "Wholesaler" | "Importer" | "Other";
type ProductCategory = "Dry Products" | "Frozen Products" | "Cosmetic Products" | "Other";

interface Product {
  id: string;
  name: string;
  description: string;
  brand: string;
  category: ProductCategory | "";
  supplyCapacity: string;
  minOrderQty: string;
  priceRange: string;
}

interface DocFile { type: string; fileName: string; uploadedAt: string; dataUrl?: string; }

interface TimelineEntry { id: string; action: string; date: string; actor: string; note?: string; }

interface SupplierApplication {
  id: string;
  companyName: string;
  businessRegNo: string;
  tin: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  contactPhone: string;
  supplierType: SupplierType | "";
  products: Product[];
  yearsInBusiness: string;
  distributionArea: string;
  deliveryCapability: string;
  paymentTerms: string;
  leadTime: string;
  documents: DocFile[];
  status: AppStatus;
  submittedAt: string;
  updatedAt: string;
  rejectionReason?: string;
  revisionNote?: string;
  timeline: TimelineEntry[];
}

interface Supplier {
  id: string;
  applicationId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  supplierType: SupplierType;
  products: Product[];
  address: string;
  email: string;
  phone: string;
  website: string;
  distributionArea: string;
  yearsInBusiness: string;
  status: "active" | "inactive";
  approvedAt: string;
  evaluationScore: number;
  performanceRating: number;
  lastEvaluated: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actor: string;
  timestamp: string;
  details: string;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const STATUS_CFG: Record<AppStatus, { label: string; cls: string; dot: string; icon: React.ReactNode }> = {
  pending_review:    { label: "Pending Review",    cls: "bg-amber-50 text-amber-700 border-amber-200",  dot: "bg-amber-500",  icon: <Clock size={12} /> },
  under_review:      { label: "Under Review",      cls: "bg-sky-50 text-sky-700 border-sky-200",  dot: "bg-sky-500",    icon: <Eye size={12} /> },
  revision_required: { label: "Revision Required", cls: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", icon: <AlertTriangle size={12} /> },
  approved:          { label: "Approved",           cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500",  icon: <CheckCircle size={12} /> },
  rejected:          { label: "Rejected",           cls: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-500",    icon: <XCircle size={12} /> },
};

const SUPPLIER_TYPES: SupplierType[] = ["Manufacturer", "Distributor", "Wholesaler", "Importer", "Other"];
const PRODUCT_CATEGORIES: ProductCategory[] = ["Dry Products", "Frozen Products", "Cosmetic Products", "Other"];
const DOCUMENT_TYPES = ["Business Registration", "Tax Registration", "Business Permit", "Product Catalog", "Price List", "Company Profile"];
const REQUIRED_DOCS = ["Business Registration", "Tax Registration", "Business Permit"];

// ─────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────

const INIT_APPS: SupplierApplication[] = [
  {
    id: "APP-2025-18234",
    companyName: "Pacific Fresh Distributors Inc.",
    businessRegNo: "CS202012345",
    tin: "123-456-789-000",
    address: "45 Macapagal Blvd, Pasay City, Metro Manila",
    email: "info@pacificfresh.ph",
    phone: "+63 2 8888 5555",
    website: "www.pacificfresh.ph",
    contactName: "Maria Santos",
    contactPosition: "Sales Manager",
    contactEmail: "maria.santos@pacificfresh.ph",
    contactPhone: "+63 917 123 4567",
    supplierType: "Distributor",
    products: [
      { id: "p1", name: "Premium Frozen Tilapia Fillet", description: "Grade A frozen tilapia fillets, IQF processed, sizes 100–200g.", brand: "Pacific Fresh", category: "Frozen Products", supplyCapacity: "50 MT/month", minOrderQty: "500 kg", priceRange: "₱180–220/kg" },
      { id: "p2", name: "Frozen Shrimp Vannamei (HLSO)", description: "Head-less shell-on frozen shrimp, various count sizes available.", brand: "Pacific Fresh", category: "Frozen Products", supplyCapacity: "20 MT/month", minOrderQty: "200 kg", priceRange: "₱380–480/kg" },
    ],
    yearsInBusiness: "12",
    distributionArea: "Metro Manila, Luzon",
    deliveryCapability: "Own refrigerated fleet, nationwide delivery capability",
    paymentTerms: "30 days credit",
    leadTime: "3–5 business days",
    documents: [
      { type: "Business Registration", fileName: "pacific_fresh_bir.pdf", uploadedAt: "2025-01-15" },
      { type: "Tax Registration", fileName: "pacific_fresh_tin.pdf", uploadedAt: "2025-01-15" },
      { type: "Business Permit", fileName: "pacific_fresh_permit.pdf", uploadedAt: "2025-01-15" },
      { type: "Product Catalog", fileName: "pacific_fresh_catalog.pdf", uploadedAt: "2025-01-15" },
    ],
    status: "under_review",
    submittedAt: "2025-01-15T09:30:00",
    updatedAt: "2025-01-16T14:00:00",
    timeline: [
      { id: "t1", action: "Application Submitted", date: "2025-01-15T09:30:00", actor: "Maria Santos (Applicant)" },
      { id: "t2", action: "Status changed to Under Review", date: "2025-01-16T14:00:00", actor: "Admin: Juan dela Cruz", note: "All required documents present. Proceeding to full evaluation." },
    ],
  },
  {
    id: "APP-2025-22891",
    companyName: "NutriCare Products Corp.",
    businessRegNo: "CS201987654",
    tin: "987-654-321-000",
    address: "123 EDSA, Mandaluyong City, Metro Manila",
    email: "procurement@nutricare.ph",
    phone: "+63 2 7777 4444",
    website: "www.nutricare.ph",
    contactName: "Roberto Lim",
    contactPosition: "Business Development Officer",
    contactEmail: "r.lim@nutricare.ph",
    contactPhone: "+63 918 987 6543",
    supplierType: "Manufacturer",
    products: [
      { id: "p3", name: "Organic Rice Bran Oil (1L)", description: "Cold-pressed, certified organic rice bran oil with high smoke point.", brand: "NutriCare Gold", category: "Dry Products", supplyCapacity: "100 MT/month", minOrderQty: "1 MT", priceRange: "₱85–95/liter" },
    ],
    yearsInBusiness: "8",
    distributionArea: "Nationwide",
    deliveryCapability: "3PL partnerships (LBC Freight), delivery anywhere in PH within 5 days",
    paymentTerms: "15 days net",
    leadTime: "7–10 business days",
    documents: [
      { type: "Business Registration", fileName: "nutricare_bir.pdf", uploadedAt: "2025-01-20" },
      { type: "Tax Registration", fileName: "nutricare_tin.pdf", uploadedAt: "2025-01-20" },
      { type: "Business Permit", fileName: "nutricare_permit.pdf", uploadedAt: "2025-01-20" },
      { type: "Product Catalog", fileName: "nutricare_catalog.pdf", uploadedAt: "2025-01-20" },
      { type: "Company Profile", fileName: "nutricare_profile.pdf", uploadedAt: "2025-01-20" },
    ],
    status: "pending_review",
    submittedAt: "2025-01-20T11:00:00",
    updatedAt: "2025-01-20T11:00:00",
    timeline: [
      { id: "t1", action: "Application Submitted", date: "2025-01-20T11:00:00", actor: "Roberto Lim (Applicant)" },
    ],
  },
  {
    id: "APP-2024-91023",
    companyName: "BeautyPH Cosmetics Inc.",
    businessRegNo: "CS202054321",
    tin: "456-789-012-000",
    address: "78 Shaw Blvd, Mandaluyong City, Metro Manila",
    email: "sales@beautyphcosmetics.com",
    phone: "+63 2 6666 3333",
    website: "www.beautyphcosmetics.com",
    contactName: "Ana Reyes",
    contactPosition: "Account Executive",
    contactEmail: "a.reyes@beautyphcosmetics.com",
    contactPhone: "+63 920 543 2109",
    supplierType: "Importer",
    products: [
      { id: "p4", name: "Korean BB Cream SPF 50+", description: "Multi-function BB cream with sun protection and moisturizing formula.", brand: "GlowKor", category: "Cosmetic Products", supplyCapacity: "10,000 units/month", minOrderQty: "500 units", priceRange: "₱350–420/unit" },
      { id: "p5", name: "Hyaluronic Acid Serum 30ml", description: "2% HA serum with panthenol and ceramide complex for intense hydration.", brand: "GlowKor", category: "Cosmetic Products", supplyCapacity: "8,000 units/month", minOrderQty: "300 units", priceRange: "₱480–560/unit" },
    ],
    yearsInBusiness: "5",
    distributionArea: "Metro Manila, Cebu, Davao",
    deliveryCapability: "Courier partners (LBC, J&T Express), in-house delivery within Metro Manila",
    paymentTerms: "45 days credit",
    leadTime: "14–21 days (imported goods)",
    documents: [
      { type: "Business Registration", fileName: "beautyph_bir.pdf", uploadedAt: "2024-12-10" },
      { type: "Tax Registration", fileName: "beautyph_tin.pdf", uploadedAt: "2024-12-10" },
      { type: "Business Permit", fileName: "beautyph_permit.pdf", uploadedAt: "2024-12-10" },
      { type: "Product Catalog", fileName: "beautyph_catalog.pdf", uploadedAt: "2024-12-10" },
      { type: "Price List", fileName: "beautyph_pricelist.pdf", uploadedAt: "2024-12-10" },
    ],
    status: "approved",
    submittedAt: "2024-12-10T10:00:00",
    updatedAt: "2024-12-20T16:30:00",
    timeline: [
      { id: "t1", action: "Application Submitted", date: "2024-12-10T10:00:00", actor: "Ana Reyes (Applicant)" },
      { id: "t2", action: "Status changed to Under Review", date: "2024-12-12T09:00:00", actor: "Admin: Juan dela Cruz" },
      { id: "t3", action: "Application Approved", date: "2024-12-20T16:30:00", actor: "Admin: Juan dela Cruz", note: "All documents verified. Supplier ID SUP-2024-10001 generated." },
    ],
  },
  {
    id: "APP-2024-77312",
    companyName: "Sunrise Grocery Wholesale",
    businessRegNo: "CS201912345",
    tin: "321-654-987-000",
    address: "200 Quezon Avenue, Quezon City, Metro Manila",
    email: "contact@sunrisegrocery.ph",
    phone: "+63 2 5555 2222",
    website: "",
    contactName: "Pedro Garcia",
    contactPosition: "Owner / Manager",
    contactEmail: "pedro@sunrisegrocery.ph",
    contactPhone: "+63 915 321 6549",
    supplierType: "Wholesaler",
    products: [
      { id: "p6", name: "Assorted Canned Goods Bundle", description: "Mixed canned goods: sardines, corned beef, tuna, and spam variants.", brand: "Various", category: "Dry Products", supplyCapacity: "5,000 cases/month", minOrderQty: "100 cases", priceRange: "₱1,200–1,800/case" },
    ],
    yearsInBusiness: "15",
    distributionArea: "Metro Manila, Rizal, Bulacan, Cavite",
    deliveryCapability: "Own delivery trucks, guaranteed 48-hour delivery",
    paymentTerms: "COD or 7 days net",
    leadTime: "1–2 business days",
    documents: [
      { type: "Business Registration", fileName: "sunrise_bir.pdf", uploadedAt: "2024-11-05" },
      { type: "Business Permit", fileName: "sunrise_permit.pdf", uploadedAt: "2024-11-05" },
    ],
    status: "revision_required",
    submittedAt: "2024-11-05T13:00:00",
    updatedAt: "2024-11-10T11:00:00",
    revisionNote: "Please upload the following missing documents: (1) Tax Registration Certificate (BIR Form 2303), (2) Product Catalog with current prices. Submitted documents are incomplete for full evaluation.",
    timeline: [
      { id: "t1", action: "Application Submitted", date: "2024-11-05T13:00:00", actor: "Pedro Garcia (Applicant)" },
      { id: "t2", action: "Status changed to Under Review", date: "2024-11-07T10:00:00", actor: "Admin: Juan dela Cruz" },
      { id: "t3", action: "Revision Required", date: "2024-11-10T11:00:00", actor: "Admin: Juan dela Cruz", note: "Missing TIN registration certificate and product catalog." },
    ],
  },
  {
    id: "APP-2024-55678",
    companyName: "FastCargo Logistics Corp.",
    businessRegNo: "CS202098765",
    tin: "789-012-345-000",
    address: "15 Airport Road, Paranaque City, Metro Manila",
    email: "biz@fastcargo.ph",
    phone: "+63 2 4444 1111",
    website: "www.fastcargo.ph",
    contactName: "James Torres",
    contactPosition: "VP Operations",
    contactEmail: "j.torres@fastcargo.ph",
    contactPhone: "+63 916 789 0123",
    supplierType: "Distributor",
    products: [
      { id: "p7", name: "Industrial Packing Materials", description: "Cardboard boxes, bubble wrap, stretch film, and assorted packaging supplies.", brand: "PackRight", category: "Other", supplyCapacity: "50,000 units/month", minOrderQty: "1,000 units", priceRange: "₱15–85/unit" },
    ],
    yearsInBusiness: "3",
    distributionArea: "Metro Manila only",
    deliveryCapability: "Company vans, next-day delivery within Metro Manila",
    paymentTerms: "30 days credit",
    leadTime: "1 business day",
    documents: [
      { type: "Business Registration", fileName: "fastcargo_bir.pdf", uploadedAt: "2024-10-20" },
      { type: "Tax Registration", fileName: "fastcargo_tin.pdf", uploadedAt: "2024-10-20" },
      { type: "Business Permit", fileName: "fastcargo_permit.pdf", uploadedAt: "2024-10-20" },
    ],
    status: "rejected",
    submittedAt: "2024-10-20T08:00:00",
    updatedAt: "2024-10-28T15:00:00",
    rejectionReason: "The company does not meet our minimum 5-year business track record requirement (currently 3 years). Additionally, the product category (industrial packaging) does not align with our current sourcing needs in food and consumer goods. The applicant may reapply after meeting the experience requirements.",
    timeline: [
      { id: "t1", action: "Application Submitted", date: "2024-10-20T08:00:00", actor: "James Torres (Applicant)" },
      { id: "t2", action: "Status changed to Under Review", date: "2024-10-22T10:00:00", actor: "Admin: Ana Villanueva" },
      { id: "t3", action: "Application Rejected", date: "2024-10-28T15:00:00", actor: "Admin: Ana Villanueva", note: "Does not meet minimum 5-year experience requirement; product category mismatch." },
    ],
  },
];

const INIT_SUPPLIERS: Supplier[] = [
  {
    id: "SUP-2024-10001",
    applicationId: "APP-2024-91023",
    companyName: "BeautyPH Cosmetics Inc.",
    contactName: "Ana Reyes",
    contactEmail: "a.reyes@beautyphcosmetics.com",
    contactPhone: "+63 920 543 2109",
    supplierType: "Importer",
    products: [
      { id: "p4", name: "Korean BB Cream SPF 50+", description: "Multi-function BB cream", brand: "GlowKor", category: "Cosmetic Products", supplyCapacity: "10,000 units/month", minOrderQty: "500 units", priceRange: "₱350–420/unit" },
      { id: "p5", name: "Hyaluronic Acid Serum 30ml", description: "2% HA serum", brand: "GlowKor", category: "Cosmetic Products", supplyCapacity: "8,000 units/month", minOrderQty: "300 units", priceRange: "₱480–560/unit" },
    ],
    address: "78 Shaw Blvd, Mandaluyong City, Metro Manila",
    email: "sales@beautyphcosmetics.com",
    phone: "+63 2 6666 3333",
    website: "www.beautyphcosmetics.com",
    distributionArea: "Metro Manila, Cebu, Davao",
    yearsInBusiness: "5",
    status: "active",
    approvedAt: "2024-12-20T16:30:00",
    evaluationScore: 87,
    performanceRating: 4.2,
    lastEvaluated: "2025-01-10T10:00:00",
  },
];

const INIT_AUDIT: AuditLog[] = [
  { id: "AL-005", action: "APPLICATION_STATUS_CHANGED", entity: "SupplierApplication", entityId: "APP-2025-18234", actor: "Admin: Juan dela Cruz", timestamp: "2025-01-16T14:00:00", details: "Status changed from Pending Review to Under Review." },
  { id: "AL-003", action: "APPLICATION_APPROVED", entity: "SupplierApplication", entityId: "APP-2024-91023", actor: "Admin: Juan dela Cruz", timestamp: "2024-12-20T16:30:00", details: "Application approved. Supplier record created: SUP-2024-10001." },
  { id: "AL-004", action: "SUPPLIER_CREATED", entity: "Supplier", entityId: "SUP-2024-10001", actor: "System", timestamp: "2024-12-20T16:30:01", details: "Official supplier record auto-generated from application APP-2024-91023." },
  { id: "AL-002", action: "REVISION_REQUIRED", entity: "SupplierApplication", entityId: "APP-2024-77312", actor: "Admin: Juan dela Cruz", timestamp: "2024-11-10T11:00:00", details: "Revision required: Missing TIN certificate and product catalog." },
  { id: "AL-001", action: "APPLICATION_REJECTED", entity: "SupplierApplication", entityId: "APP-2024-55678", actor: "Admin: Ana Villanueva", timestamp: "2024-10-28T15:00:00", details: "Rejected: Does not meet minimum experience requirement; product category mismatch." },
];

const INIT_NOTIFS: AppNotification[] = [
  { id: "N-001", title: "New Application Received", message: "NutriCare Products Corp. submitted a supplier application (APP-2025-22891).", type: "info", read: false, timestamp: "2025-01-20T11:00:00" },
  { id: "N-002", title: "Application Under Review", message: "Pacific Fresh Distributors Inc. (APP-2025-18234) is now under review.", type: "info", read: false, timestamp: "2025-01-16T14:00:00" },
  { id: "N-003", title: "Supplier Approved", message: "BeautyPH Cosmetics Inc. approved as official supplier (SUP-2024-10001).", type: "success", read: true, timestamp: "2024-12-20T16:30:00" },
  { id: "N-004", title: "Revision Required", message: "Sunrise Grocery Wholesale notified to revise application (APP-2024-77312).", type: "warning", read: true, timestamp: "2024-11-10T11:00:00" },
  { id: "N-005", title: "Application Rejected", message: "FastCargo Logistics Corp. application (APP-2024-55678) has been rejected.", type: "error", read: true, timestamp: "2024-10-28T15:00:00" },
];

// ─────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────

const genId = (pfx: string) => `${pfx}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
const now = () => new Date().toISOString();

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const newProduct = (): Product => ({
  id: Math.random().toString(36).slice(2),
  name: "", description: "", brand: "", category: "",
  supplyCapacity: "", minOrderQty: "", priceRange: "",
});

// ─────────────────────────────────────────────────────────
// PERSISTENCE LAYER (client-side "database")
// ─────────────────────────────────────────────────────────

const LS_KEYS = {
  apps: "trim_vendor_applications",
  suppliers: "trim_vendor_suppliers",
  audit: "trim_vendor_audit",
  notifs: "trim_vendor_notifications",
  auth: "trim_vendor_admin_auth",
};

function usePersisted<T>(key: string, seed: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch { /* ignore corrupt data */ }
    try { localStorage.setItem(key, JSON.stringify(seed)); } catch { /* ignore quota */ }
    return seed;
  });
  const set: Dispatch<SetStateAction<T>> = (v) => {
    setState((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  };
  return [state, set];
}

// ─────────────────────────────────────────────────────────
// REUSABLE UI
// ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: AppStatus }) => {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const SupStatusBadge = ({ status }: { status: "active" | "inactive" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
    {status === "active" ? "Active" : "Inactive"}
  </span>
);

const inp = "w-full min-h-[44px] px-3.5 py-2.5 text-[15px] sm:text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b21b6]/30 focus:border-[#5b21b6]/40 transition-colors";
const selectCls = `${inp} cursor-pointer appearance-none`;

interface FieldProps { label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string; }
const Field = ({ label, required, error, children, hint }: FieldProps) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-slate-700">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {hint && <p className="text-xs text-slate-400 -mt-0.5">{hint}</p>}
    {children}
    {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
  </div>
);

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-50 text-violet-600 shrink-0">{icon}</div>
    <div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm transition-shadow duration-200 ${className}`}>{children}</div>
);

interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; }
const Modal = ({ open, onClose, title, children }: ModalProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100 p-1 -mr-1"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
};

const KpiCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
  <Card className="p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    </div>
  </Card>
);

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={13} className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"} />
    ))}
    <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>
  </div>
);

const MonoId = ({ id }: { id: string }) => (
  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded tracking-tight">{id}</span>
);

// ─────────────────────────────────────────────────────────
// PUBLIC NAV
// ─────────────────────────────────────────────────────────

const PublicNav = ({ onNav, current }: { onNav: (p: Page) => void; current?: Page }) => {
  const [open, setOpen] = useState(false);
  const isActive = (p: Page) => current === p || (p === "apply" && current === "apply-success");
  const linkCls = (p: Page) =>
    isActive(p)
      ? "px-4 py-2 text-sm font-semibold bg-[#5b21b6] text-white rounded-xl transition-all duration-200 shadow-sm"
      : "px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#5b21b6] hover:bg-slate-50 rounded-xl transition-all duration-200";
  const mobileCls = (p: Page) =>
    isActive(p)
      ? "text-left px-3 py-2.5 text-sm font-semibold text-white bg-[#5b21b6] rounded-xl flex items-center gap-2"
      : "text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl";
  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button onClick={() => onNav("home")} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#5b21b6] flex items-center justify-center shadow-sm group-hover:bg-[#4c1d95] transition-colors">
            <Layers size={17} className="text-white" />
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-bold text-slate-800 tracking-wide">TRI-M GLOBAL</div>
            <div className="text-[10px] text-slate-400 tracking-wider">LOGISTICS &amp; TRADING</div>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-1.5">
          <button onClick={() => onNav("home")} className={linkCls("home")}>Home</button>
          <button onClick={() => onNav("status")} className={linkCls("status")}>Check Application Status</button>
          <button onClick={() => onNav("apply")} className="btn btn-primary text-xs px-4 py-2 ml-1">Become a Supplier</button>
        </div>

        <button className="md:hidden p-2 text-slate-600" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="menu-panel md:hidden border-t border-slate-100 bg-white px-4 py-3 flex flex-col gap-1">
          <button onClick={() => { onNav("home"); setOpen(false); }} className={mobileCls("home")}>Home</button>
          <button onClick={() => { onNav("status"); setOpen(false); }} className={mobileCls("status")}>Check Application Status</button>
          <button onClick={() => { onNav("apply"); setOpen(false); }} className="btn btn-primary text-sm px-3 py-2.5 mt-1 justify-center">Become a Supplier</button>
        </div>
      )}
    </nav>
  );
};

// ─────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────

const HomePage = ({ onNav }: { onNav: (p: Page) => void }) => (
  <div>
    <PublicNav onNav={onNav} current="home" />

    {/* ── HERO ──────────────────────────────────────────── */}
    <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-white to-white">
      {/* Logistics visual: soft violet blobs + faint dot grid */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-violet-200/40 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-[#5b21b6]/10 blur-3xl"></div>
      <div className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "radial-gradient(#c4b5fd 1px, transparent 1px)", backgroundSize: "26px 26px" }}></div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-14 sm:pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Text column */}
          <div className="reveal text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-violet-100 text-[#5b21b6] rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide mb-5">
              <Package size={13} /> VENDOR MANAGEMENT PORTAL
            </div>
            <h1 className="text-[clamp(2rem,4vw+1rem,3.25rem)] font-bold leading-[1.12] mb-4 text-slate-900">
              Partner with <span className="text-[#5b21b6]">Tri-M Global</span><br className="hidden sm:block" />
              Logistics &amp; Trading
            </h1>
            <p className="text-base sm:text-lg text-slate-500 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Join our growing network of trusted suppliers. Apply online, track your application status, and become part of our supply chain.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row justify-center lg:justify-start">
              <button onClick={() => onNav("status")}
                className="btn btn-primary px-6 py-3 text-sm">
                <Search size={16} /> Check Application Status
              </button>
              <button onClick={() => onNav("apply")}
                className="btn btn-secondary px-6 py-3 text-sm">
                Become a Supplier <ArrowRight size={16} />
              </button>
            </div>
            <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-slate-500">
              <div className="text-center lg:text-left">
                <div className="text-xl font-bold text-slate-800">500+</div>
                <div className="text-[11px] uppercase tracking-wide">Suppliers</div>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center lg:text-left">
                <div className="text-xl font-bold text-slate-800">3+</div>
                <div className="text-[11px] uppercase tracking-wide">Categories</div>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center lg:text-left">
                <div className="text-xl font-bold text-slate-800">98%</div>
                <div className="text-[11px] uppercase tracking-wide">On-time</div>
              </div>
            </div>
          </div>

          {/* Visual column: supply-network panel */}
          <div className="reveal reveal-delay-1 relative">
            <div className="surface p-6 sm:p-7 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-violet-100/60 blur-2xl"></div>
              <div className="flex items-center gap-3 mb-6 relative">
                <div className="w-10 h-10 rounded-xl bg-[#5b21b6] text-white flex items-center justify-center"><Layers size={20} /></div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Supply Network</div>
                  <div className="text-xs text-slate-500">Connected &amp; verified</div>
                </div>
              </div>
              {/* node chain */}
              <div className="relative flex items-center justify-between mb-6">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-12 h-12 rounded-full bg-violet-50 text-[#5b21b6] flex items-center justify-center"><Package size={22} /></div>
                  <span className="text-[11px] text-slate-500">Suppliers</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-violet-300 to-violet-400 relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#5b21b6]"></div>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-12 h-12 rounded-full bg-[#5b21b6] text-white flex items-center justify-center"><Building2 size={22} /></div>
                  <span className="text-[11px] text-slate-500">Tri-M Hub</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-violet-400 to-violet-300 relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#5b21b6]"></div>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-12 h-12 rounded-full bg-violet-50 text-[#5b21b6] flex items-center justify-center"><Truck size={22} /></div>
                  <span className="text-[11px] text-slate-500">Distribution</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 relative">
                {[
                  { label: "Verified", value: "100%", icon: <ShieldCheck size={15} /> },
                  { label: "Active", value: "320", icon: <Boxes size={15} /> },
                  { label: "Countries", value: "12", icon: <Globe size={15} /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-center">
                    <div className="text-[#5b21b6] flex justify-center mb-1">{icon}</div>
                    <div className="text-sm font-bold text-slate-800">{value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ── WHY PARTNER WITH TRI-M ────────────────────────── */}
    <section className="bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 triM-section">
        <div className="reveal text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">Why Partner With Tri-M</h2>
          <p className="text-slate-500 text-sm">A transparent, opportunity-driven partnership built for suppliers who value reliability and growth.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <Handshake size={22} />, title: "Trusted Partnership", desc: "Join a vetted network backed by a reputable logistics and trading company." },
            { icon: <TrendingUp size={22} />, title: "Business Opportunity", desc: "Access steady demand and new channels through our procurement ecosystem." },
            { icon: <FileCheck size={22} />, title: "Simple Application", desc: "A clean, guided online form — apply in minutes with no paperwork hassle." },
            { icon: <ShieldCheck size={22} />, title: "Transparent Review", desc: "Track every status change in real time, from submission to final decision." },
          ].map(({ icon, title, desc }, i) => (
            <div key={title} className={`reveal reveal-delay-${i} surface p-6 card-hover`}>
              <div className="w-11 h-11 rounded-xl bg-violet-50 text-[#5b21b6] flex items-center justify-center mb-4">{icon}</div>
              <h3 className="font-bold text-slate-800 mb-1.5 text-sm">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── HOW IT WORKS ─────────────────────────────────── */}
    <section className="bg-slate-50 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 triM-section">
        <div className="reveal text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">How It Works</h2>
          <p className="text-slate-500 text-sm">Four simple steps to become an official Tri-M supplier</p>
        </div>
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
          {/* connecting line behind step circles (desktop) */}
          <div className="hidden lg:block absolute top-7 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-violet-200 via-violet-300 to-violet-200"></div>
          {[
            { n: "01", icon: <FileText size={20} />, title: "Submit Application", desc: "Complete the online supplier application form with your company, product, and business details." },
            { n: "02", icon: <Eye size={20} />, title: "Admin Review", desc: "Our procurement team reviews your application, verifies documents, and evaluates your offer." },
            { n: "03", icon: <CheckCircle size={20} />, title: "Approval Decision", desc: "You will be notified of approval, rejection, or if any revisions are needed to your application." },
            { n: "04", icon: <Award size={20} />, title: "Become Official Supplier", desc: "Upon approval, receive your Supplier ID and gain access to our purchasing and evaluation ecosystem." },
          ].map(({ n, icon, title, desc }, i) => (
            <div key={n} className={`reveal reveal-delay-${i} relative text-center`}>
              <div className="relative z-10 mx-auto w-14 h-14 rounded-full bg-[#5b21b6] text-white flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4">{icon}</div>
              <div className="text-xs font-bold text-[#5b21b6] mb-1 font-mono tracking-widest">{n}</div>
              <h3 className="font-bold text-slate-800 mb-1.5 text-sm">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[15rem] mx-auto">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── SUPPLIER CATEGORIES ──────────────────────────── */}
    <section className="bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 triM-section">
        <div className="reveal text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">We Source Across Categories</h2>
          <p className="text-slate-500 text-sm">From pantry staples to personal care — explore where your products fit.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { cat: "Dry Products", icon: <Package size={24} />, desc: "Rice, canned goods, condiments, snacks, beverages" },
            { cat: "Frozen Products", icon: <Boxes size={24} />, desc: "Seafood, meat, poultry, vegetables, ready meals" },
            { cat: "Cosmetic Products", icon: <Layers size={24} />, desc: "Skincare, haircare, personal care, beauty items" },
            { cat: "Other Categories", icon: <Truck size={24} />, desc: "Household items, general merchandise, specialty goods" },
          ].map(({ cat, icon, desc }) => (
            <div key={cat} className="group bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm card-hover hover:border-violet-300 hover:shadow-violet-200/40">
              <div className="w-12 h-12 rounded-xl bg-[#5b21b6]/5 text-[#5b21b6] group-hover:bg-[#5b21b6] group-hover:text-white flex items-center justify-center mx-auto mb-3 transition-colors duration-200">{icon}</div>
              <h4 className="font-bold text-slate-800 text-sm mb-1">{cat}</h4>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ──────────────────────────────────────────── */}
    <section className="relative overflow-hidden bg-[#2e1065] text-white">
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-violet-400/10 blur-3xl"></div>
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <div className="reveal">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Partner With Tri-M?</h2>
          <p className="text-violet-200 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Start your supplier application today. It only takes a few minutes, and you can track your status every step of the way.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row justify-center">
            <button onClick={() => onNav("apply")}
              className="btn px-6 py-3 text-sm bg-white text-[#2e1065] hover:bg-violet-50 font-semibold shadow-sm">
              Become a Supplier <ArrowRight size={16} />
            </button>
            <button onClick={() => onNav("status")}
              className="btn px-6 py-3 text-sm border border-violet-300/50 text-white hover:bg-white/10 font-semibold">
              Check Application Status
            </button>
          </div>
        </div>
      </div>
    </section>

    {/* ── FOOTER ───────────────────────────────────────── */}
    <footer className="bg-[#1e0a4a] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded bg-violet-400/20 flex items-center justify-center"><Layers size={12} className="text-violet-400" /></div>
          <span className="text-sm font-bold tracking-wide">Tri-M Global Logistics & Trading Inc.</span>
        </div>
        <p className="text-xs text-slate-400">Vendor Management Portal · © {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </footer>
  </div>
);

// ─────────────────────────────────────────────────────────
// APPLICATION FORM
// ─────────────────────────────────────────────────────────

type FormData = {
  companyName: string; businessRegNo: string; tin: string;
  address: string; email: string; phone: string; website: string;
  contactName: string; contactPosition: string; contactEmail: string; contactPhone: string;
  supplierType: string;
  yearsInBusiness: string; distributionArea: string; deliveryCapability: string;
  paymentTerms: string; leadTime: string;
  agreedToTerms: boolean;
};

const initForm = (): FormData => ({
  companyName: "", businessRegNo: "", tin: "", address: "", email: "", phone: "", website: "",
  contactName: "", contactPosition: "", contactEmail: "", contactPhone: "",
  supplierType: "",
  yearsInBusiness: "", distributionArea: "", deliveryCapability: "", paymentTerms: "", leadTime: "",
  agreedToTerms: false,
});

const initFormFromApp = (app: SupplierApplication): FormData => ({
  companyName: app.companyName, businessRegNo: app.businessRegNo, tin: app.tin,
  address: app.address, email: app.email, phone: app.phone, website: app.website,
  contactName: app.contactName, contactPosition: app.contactPosition, contactEmail: app.contactEmail, contactPhone: app.contactPhone,
  supplierType: app.supplierType,
  yearsInBusiness: app.yearsInBusiness, distributionArea: app.distributionArea, deliveryCapability: app.deliveryCapability, paymentTerms: app.paymentTerms, leadTime: app.leadTime,
  agreedToTerms: true,
});

const docsFromApp = (app: SupplierApplication): Record<string, { fileName: string; dataUrl: string }> =>
  Object.fromEntries(app.documents.map(d => [d.type, { fileName: d.fileName, dataUrl: d.dataUrl ?? "" }]));

const ApplyForm = ({
  onSubmit, initialApp, onUpdate, onNav, current
}: {
  onSubmit: (app: SupplierApplication) => void;
  initialApp?: SupplierApplication | null;
  onUpdate?: (app: SupplierApplication) => void;
  onNav: (p: Page) => void;
  current?: Page;
}) => {
  const [form, setForm] = useState<FormData>(() => initialApp ? initFormFromApp(initialApp) : initForm());
  const [products, setProducts] = useState<Product[]>(() => initialApp ? initialApp.products.map(p => ({ ...p })) : [newProduct()]);
  const [docs, setDocs] = useState<Record<string, { fileName: string; dataUrl: string }>>(() => initialApp ? docsFromApp(initialApp) : {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const set = (k: keyof FormData, v: string | boolean) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  const setProduct = (id: string, k: keyof Product, v: string) =>
    setProducts(ps => ps.map(p => p.id === id ? { ...p, [k]: v } : p));

  const addProduct = () => setProducts(ps => [...ps, newProduct()]);
  const removeProduct = (id: string) => setProducts(ps => ps.filter(p => p.id !== id));

  const handleFile = (type: string, file: File | undefined) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setErrors(e => ({ ...e, [`doc_${type}`]: "Only PDF, JPG, PNG files are accepted." }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors(e => ({ ...e, [`doc_${type}`]: "File size must not exceed 10 MB." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocs(d => ({ ...d, [type]: { fileName: file.name, dataUrl: String(reader.result) } }));
      setErrors(e => ({ ...e, [`doc_${type}`]: "" }));
    };
    reader.onerror = () => setErrors(e => ({ ...e, [`doc_${type}`]: "Failed to read file." }));
    reader.readAsDataURL(file);
  };

  const removeDoc = (type: string) => {
    setDocs(d => { const n = { ...d }; delete n[type]; return n; });
    setErrors(e => ({ ...e, [`doc_${type}`]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = "Company name is required.";
    if (!form.businessRegNo.trim()) e.businessRegNo = "Business registration number is required.";
    if (!form.tin.trim()) e.tin = "TIN is required.";
    if (!form.address.trim()) e.address = "Address is required.";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email is required.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    if (!form.contactName.trim()) e.contactName = "Contact name is required.";
    if (!form.contactPosition.trim()) e.contactPosition = "Position is required.";
    if (!form.contactEmail.trim() || !/\S+@\S+\.\S+/.test(form.contactEmail)) e.contactEmail = "Valid email is required.";
    if (!form.contactPhone.trim()) e.contactPhone = "Contact phone is required.";
    if (!form.supplierType) e.supplierType = "Supplier type is required.";
    products.forEach((p, i) => {
      if (!p.name.trim()) e[`product_name_${i}`] = "Product name is required.";
      if (!p.category) e[`product_cat_${i}`] = "Category is required.";
    });
    if (!form.yearsInBusiness) e.yearsInBusiness = "Years in business is required.";
    if (!form.distributionArea.trim()) e.distributionArea = "Distribution area is required.";
    if (!form.paymentTerms.trim()) e.paymentTerms = "Payment terms are required.";
    if (!form.leadTime.trim()) e.leadTime = "Lead time is required.";
    REQUIRED_DOCS.forEach(dt => {
      if (!docs[dt]) e[`doc_${dt}`] = `${dt} is required.`;
    });
    if (!form.agreedToTerms) e.agreedToTerms = "You must agree to the terms and conditions.";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(`field-${firstKey}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    const documents = Object.entries(docs).map(([type, doc]) => ({ type, fileName: doc.fileName, dataUrl: doc.dataUrl, uploadedAt: new Date().toISOString().slice(0, 10) }));
    const baseFields = {
      companyName: form.companyName,
      businessRegNo: form.businessRegNo,
      tin: form.tin,
      address: form.address,
      email: form.email,
      phone: form.phone,
      website: form.website,
      contactName: form.contactName,
      contactPosition: form.contactPosition,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      supplierType: form.supplierType as SupplierType,
      products,
      yearsInBusiness: form.yearsInBusiness,
      distributionArea: form.distributionArea,
      deliveryCapability: form.deliveryCapability,
      paymentTerms: form.paymentTerms,
      leadTime: form.leadTime,
      documents,
    };

    if (initialApp && onUpdate) {
      const app: SupplierApplication = {
        ...initialApp,
        ...baseFields,
        status: "pending_review",
        revisionNote: undefined,
        updatedAt: now(),
        timeline: [
          ...initialApp.timeline,
          { id: `t${Date.now()}`, action: "Application Resubmitted", date: now(), actor: `${form.contactName} (Applicant)` },
        ],
      };
      setTimeout(() => { onUpdate(app); setSubmitting(false); }, 800);
    } else {
      const app: SupplierApplication = {
        id: genId("APP"),
        ...baseFields,
        status: "pending_review",
        submittedAt: now(),
        updatedAt: now(),
        timeline: [{ id: "t1", action: "Application Submitted", date: now(), actor: `${form.contactName} (Applicant)` }],
      };
      setTimeout(() => { onSubmit(app); setSubmitting(false); }, 800);
    }
  };

  return (
    <div>
      <PublicNav onNav={onNav} current={current} />
      <div className="bg-gradient-to-b from-violet-50/70 to-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-100 text-[#5b21b6] rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide mb-5">
            <Package size={13} />SUPPLIER ONBOARDING
          </div>
          <h1 className="text-[clamp(1.75rem,3vw+1rem,2.5rem)] font-bold text-slate-900 mb-3">{initialApp ? "Update Your Application" : "Become a Tri-M Supplier"}</h1>
          <p className="text-slate-500 max-w-2xl mx-auto">{initialApp ? "Revise the sections below based on the admin's feedback, then resubmit for review." : "Complete the sections below to join our verified supplier network. Our procurement team reviews every submission before approval."}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {!initialApp && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: <Building2 size={20} />, title: "Verified Network", desc: "Join Tri-M's trusted roster of logistics & trading suppliers." },
              { icon: <ClipboardList size={20} />, title: "Simple Onboarding", desc: "One organized form with clear sections and guided steps." },
              { icon: <Shield size={20} />, title: "Secure Process", desc: "Your information is confidential and used only for evaluation." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="surface p-5">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#5b21b6] flex items-center justify-center mb-3">{icon}</div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}

        {initialApp?.revisionNote && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex gap-3">
            <AlertTriangle size={18} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-orange-800 mb-1">Revision Requested — Please Update</p>
              <p className="text-xs text-orange-700 leading-relaxed">{initialApp.revisionNote}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Company Information */}
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={<Building2 size={18} />} title="Company Information" subtitle="Provide your registered business details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="md:col-span-2">
                <Field label="Company Name" required error={errors.companyName}>
                  <input id="field-companyName" className={inp} value={form.companyName}
                    onChange={e => set("companyName", e.target.value)} placeholder="e.g. ABC Trading Corp." />
                </Field>
              </div>
              <Field label="Business Registration No." required error={errors.businessRegNo}>
                <input id="field-businessRegNo" className={inp} value={form.businessRegNo}
                  onChange={e => set("businessRegNo", e.target.value)} placeholder="e.g. CS202012345" />
              </Field>
              <Field label="Tax Identification No. (TIN)" required error={errors.tin}>
                <input id="field-tin" className={inp} value={form.tin}
                  onChange={e => set("tin", e.target.value)} placeholder="e.g. 123-456-789-000" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Business Address" required error={errors.address}>
                  <textarea id="field-address" className={`${inp} resize-none`} rows={2} value={form.address}
                    onChange={e => set("address", e.target.value)} placeholder="Street, Barangay, City, Province" />
                </Field>
              </div>
              <Field label="Email Address" required error={errors.email}>
                <input id="field-email" type="email" className={inp} value={form.email}
                  onChange={e => set("email", e.target.value)} placeholder="info@company.com" />
              </Field>
              <Field label="Phone Number" required error={errors.phone}>
                <input id="field-phone" className={inp} value={form.phone}
                  onChange={e => set("phone", e.target.value)} placeholder="+63 2 1234 5678" />
              </Field>
              <Field label="Website" error={errors.website}>
                <input className={inp} value={form.website}
                  onChange={e => set("website", e.target.value)} placeholder="www.company.com (optional)" />
              </Field>
            </div>
          </Card>

          {/* Contact Person */}
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={<Users size={18} />} title="Contact Person" subtitle="Primary point of contact for this application" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <Field label="Full Name" required error={errors.contactName}>
                <input id="field-contactName" className={inp} value={form.contactName}
                  onChange={e => set("contactName", e.target.value)} placeholder="First and Last Name" />
              </Field>
              <Field label="Position / Designation" required error={errors.contactPosition}>
                <input id="field-contactPosition" className={inp} value={form.contactPosition}
                  onChange={e => set("contactPosition", e.target.value)} placeholder="e.g. Sales Manager" />
              </Field>
              <Field label="Email Address" required error={errors.contactEmail}>
                <input id="field-contactEmail" type="email" className={inp} value={form.contactEmail}
                  onChange={e => set("contactEmail", e.target.value)} placeholder="contact@company.com" />
              </Field>
              <Field label="Phone / Mobile" required error={errors.contactPhone}>
                <input id="field-contactPhone" className={inp} value={form.contactPhone}
                  onChange={e => set("contactPhone", e.target.value)} placeholder="+63 917 123 4567" />
              </Field>
            </div>
          </Card>

          {/* Supplier & Product Information */}
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={<Package size={18} />} title="Supplier & Product Information" subtitle="Tell us about your supplier type and the products you offer" />
            <div className="mb-6">
              <Field label="Supplier Type" required error={errors.supplierType} id="field-supplierType">
                <div id="field-supplierType" className="flex flex-wrap gap-2 mt-1">
                  {SUPPLIER_TYPES.map(t => (
                    <button type="button" key={t}
                      onClick={() => { set("supplierType", t); setErrors(e => ({ ...e, supplierType: "" })); }}
                      className={`flex-1 min-w-[120px] sm:flex-none px-4 py-2.5 text-sm rounded-lg border font-medium text-center transition-all duration-200 ${form.supplierType === t ? "bg-[#5b21b6] text-white border-[#5b21b6] shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {errors.supplierType && <p className="text-xs text-red-600 mt-1">{errors.supplierType}</p>}
              </Field>
            </div>

            <div className="space-y-4">
              {products.map((p, i) => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Product #{i + 1}</span>
                    {products.length > 1 && (
                      <button type="button" onClick={() => removeProduct(p.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Product Name" required error={errors[`product_name_${i}`]}>
                      <input className={inp} value={p.name} onChange={e => setProduct(p.id, "name", e.target.value)} placeholder="e.g. Frozen Tilapia Fillet" />
                    </Field>
                    <Field label="Product Category" required error={errors[`product_cat_${i}`]}>
                      <div className="relative">
                        <select className={selectCls} value={p.category} onChange={e => setProduct(p.id, "category", e.target.value)}>
                          <option value="">Select category</option>
                          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </Field>
                    <Field label="Brand">
                      <input className={inp} value={p.brand} onChange={e => setProduct(p.id, "brand", e.target.value)} placeholder="Brand name" />
                    </Field>
                    <Field label="Supply Capacity">
                      <input className={inp} value={p.supplyCapacity} onChange={e => setProduct(p.id, "supplyCapacity", e.target.value)} placeholder="e.g. 50 MT/month" />
                    </Field>
                    <Field label="Minimum Order Quantity">
                      <input className={inp} value={p.minOrderQty} onChange={e => setProduct(p.id, "minOrderQty", e.target.value)} placeholder="e.g. 500 kg" />
                    </Field>
                    <Field label="Price Range">
                      <input className={inp} value={p.priceRange} onChange={e => setProduct(p.id, "priceRange", e.target.value)} placeholder="e.g. ₱180–220/kg" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Description">
                        <textarea className={`${inp} resize-none`} rows={2} value={p.description}
                          onChange={e => setProduct(p.id, "description", e.target.value)}
                          placeholder="Brief description of the product, specifications, certifications, etc." />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addProduct}
                className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors px-3 py-2 border border-dashed border-violet-200 rounded-lg hover:bg-violet-50 w-full justify-center">
                <Plus size={16} /> Add Another Product
              </button>
            </div>
          </Card>

          {/* Business Information */}
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={<Briefcase size={18} />} title="Business Information" subtitle="Operational details to help us assess your capabilities" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <Field label="Years in Business" required error={errors.yearsInBusiness}>
                <div className="relative">
                  <select id="field-yearsInBusiness" className={selectCls} value={form.yearsInBusiness}
                    onChange={e => set("yearsInBusiness", e.target.value)}>
                    <option value="">Select range</option>
                    {["1", "2", "3", "4", "5", "6–10", "11–15", "16–20", "20+"].map(y => <option key={y} value={y}>{y} year{y === "1" ? "" : "s"}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </Field>
              <Field label="Payment Terms" required error={errors.paymentTerms}>
                <input id="field-paymentTerms" className={inp} value={form.paymentTerms}
                  onChange={e => set("paymentTerms", e.target.value)} placeholder="e.g. 30 days credit, COD" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Distribution Area" required error={errors.distributionArea}>
                  <input id="field-distributionArea" className={inp} value={form.distributionArea}
                    onChange={e => set("distributionArea", e.target.value)} placeholder="e.g. Metro Manila, Luzon, Nationwide" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Delivery Capability">
                  <textarea className={`${inp} resize-none`} rows={2} value={form.deliveryCapability}
                    onChange={e => set("deliveryCapability", e.target.value)}
                    placeholder="Describe your delivery fleet, logistics partners, coverage, and lead times." />
                </Field>
              </div>
              <Field label="Lead Time" required error={errors.leadTime}>
                <input id="field-leadTime" className={inp} value={form.leadTime}
                  onChange={e => set("leadTime", e.target.value)} placeholder="e.g. 3–5 business days" />
              </Field>
            </div>
          </Card>

          {/* Document Upload */}
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={<FileCheck size={18} />} title="Document Upload" subtitle="Upload supporting documents. PDF, JPG, or PNG, max 10MB each." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {DOCUMENT_TYPES.map(dt => {
                const isReq = REQUIRED_DOCS.includes(dt);
                const uploaded = docs[dt];
                return (
                  <div key={dt}>
                    <Field label={dt} required={isReq} error={errors[`doc_${dt}`]}>
                      <div
                        className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all hover:border-violet-400 hover:bg-violet-50 ${uploaded ? "border-green-300 bg-green-50" : "border-slate-200 bg-slate-50"}`}
                        onClick={() => fileRefs.current[dt]?.click()}>
                        <input
                          type="file"
                          ref={el => { fileRefs.current[dt] = el; }}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => handleFile(dt, e.target.files?.[0])}
                        />
                        {uploaded ? (
                          <div className="flex items-center gap-2 justify-center">
                            <CheckCircle size={16} className="text-green-500 shrink-0" />
                            <span className="text-xs text-green-700 font-medium truncate max-w-[140px]">{uploaded.fileName}</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); removeDoc(dt); }}
                              className="text-slate-400 hover:text-red-500 transition-colors" title="Remove file">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <Upload size={18} className="text-slate-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">Click to upload</p>
                          </div>
                        )}
                      </div>
                    </Field>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Terms */}
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={<Shield size={18} />} title="Terms & Confirmation" />
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed mb-4 max-h-32 overflow-y-auto">
              By submitting this application, I/we certify that all information provided is accurate and complete. I/we authorize Tri-M Global Logistics & Trading Inc. to verify all submitted information and documents. I/we understand that submission of this application does not guarantee approval, and that Tri-M reserves the right to accept or reject any application at its sole discretion. Approved suppliers must comply with Tri-M&apos;s Supplier Code of Conduct, quality standards, and contractual requirements. All documents submitted are treated as confidential and will only be used for supplier evaluation purposes.
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.agreedToTerms}
                onChange={e => set("agreedToTerms", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 cursor-pointer" />
              <span className="text-sm text-slate-700">
                I confirm that all information is accurate and I agree to the terms and conditions above.
                <span className="text-red-500 ml-0.5">*</span>
              </span>
            </label>
            {errors.agreedToTerms && <p id="field-agreedToTerms" className="text-xs text-red-600 mt-2">{errors.agreedToTerms}</p>}
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pb-6">
            <button type="button" onClick={() => { setForm(initForm()); setProducts([newProduct()]); setDocs({}); setErrors({}); }}
              className="btn btn-secondary px-6 py-2.5 w-full sm:w-auto text-sm">
              Reset Form
            </button>
            <button type="submit" disabled={submitting}
              className="btn btn-primary px-8 py-2.5 w-full sm:w-auto text-sm">
              {submitting ? <><RefreshCw size={15} className="animate-spin" />Submitting...</> : <><FileText size={15} />Submit Application</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// APPLICATION SUCCESS
// ─────────────────────────────────────────────────────────

const ApplySuccess = ({ app, onNav, current }: { app: SupplierApplication; onNav: (p: Page) => void; current?: Page }) => {
  const resubmitted = app.timeline.some(t => t.action === "Application Resubmitted");
  return (
  <div>
    <PublicNav onNav={onNav} current={current} />
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 size={40} className="text-green-500" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">{resubmitted ? "Application Resubmitted!" : "Application Submitted!"}</h1>
      <p className="text-slate-500 mb-8">{resubmitted ? "Your updated application has been received and is back in the review queue. Our procurement team will review the revisions and contact you with an update." : "Your supplier application has been received. Our procurement team will review your submission and contact you with an update."}</p>

      <Card className="p-6 mb-6 text-left">
        <div className="space-y-3">
          {[
            { label: "Application ID", value: app.id, mono: true },
            { label: "Company Name", value: app.companyName, mono: false },
            { label: "Submission Date", value: fmtDateTime(app.submittedAt), mono: false },
            { label: "Status", value: null, mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-500">{label}</span>
              {label === "Status" ? <StatusBadge status="pending_review" /> :
                mono ? <MonoId id={value as string} /> :
                  <span className="text-sm font-semibold text-slate-800">{value}</span>}
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-left">
        <div className="flex gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">Save Your Application ID</p>
            <p className="text-xs text-amber-700">Use your Application ID <strong>{app.id}</strong> and the email address <strong>{app.email}</strong> to check your application status at any time.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => onNav("status")}
          className="px-6 py-3 text-sm font-bold bg-[#5b21b6] text-white rounded-xl hover:bg-[#4c1d95] transition-colors flex items-center gap-2 justify-center">
          <Search size={16} /> Check Application Status
        </button>
        <button onClick={() => onNav("home")}
          className="px-6 py-3 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          Back to Home
        </button>
      </div>
    </div>
  </div>
  );
}

// ─────────────────────────────────────────────────────────
// STATUS CHECK
// ─────────────────────────────────────────────────────────

const StatusCheck = ({
  applications, onNav, onResubmit, current
}: { applications: SupplierApplication[]; onNav: (p: Page) => void; onResubmit: (id: string) => void; current?: Page }) => {
  const [appId, setAppId] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<SupplierApplication | null | "not_found">(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    setSearched(true);
    const found = applications.find(a =>
      a.id.toLowerCase() === appId.trim().toLowerCase() &&
      (a.email.toLowerCase() === email.trim().toLowerCase() || a.contactEmail.toLowerCase() === email.trim().toLowerCase())
    );
    setResult(found || "not_found");
  };

  return (
    <div>
      <PublicNav onNav={onNav} current={current} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Check Application Status</h1>
          <p className="text-slate-500">Enter your Application ID and email address to view your application status.</p>
        </div>

        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <Field label="Application ID" required>
              <input className={inp} value={appId} onChange={e => setAppId(e.target.value)}
                placeholder="e.g. APP-2025-12345" onKeyDown={e => e.key === "Enter" && handleSearch()} />
            </Field>
            <Field label="Email Address" required>
              <input type="email" className={inp} value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Company or contact email used in application" onKeyDown={e => e.key === "Enter" && handleSearch()} />
            </Field>
            <button onClick={handleSearch} disabled={!appId || !email}
              className="btn btn-primary w-full py-2.5 text-sm disabled:opacity-50">
              <Search size={15} /> Check Status
            </button>
          </div>
        </Card>

        {searched && result === "not_found" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <XCircle size={32} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-700 mb-1">Application not found</p>
            <p className="text-xs text-red-600">Please check your Application ID and email address.</p>
          </div>
        )}

        {searched && result && result !== "not_found" && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">{result.companyName}</h2>
                <MonoId id={result.id} />
              </div>
              <StatusBadge status={result.status} />
            </div>

            <div className="space-y-2 mb-5">
              {[
                { label: "Contact Person", value: `${result.contactName} — ${result.contactPosition}` },
                { label: "Submitted", value: fmtDateTime(result.submittedAt) },
                { label: "Last Updated", value: fmtDateTime(result.updatedAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-medium text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            {result.status === "revision_required" && result.revisionNote && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="flex gap-2 mb-1">
                  <AlertTriangle size={15} className="text-orange-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-bold text-orange-800">Revision Required</span>
                </div>
                <p className="text-xs text-orange-700 leading-relaxed">{result.revisionNote}</p>
                <button onClick={() => onResubmit(result.id)}
                  className="btn btn-warning mt-3 px-4 py-2 text-xs">
                  <RefreshCw size={13} /> Resubmit Application
                </button>
              </div>
            )}

            {result.status === "rejected" && result.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex gap-2 mb-1">
                  <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-bold text-red-800">Application Rejected</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">{result.rejectionReason}</p>
              </div>
            )}

            {result.status === "approved" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
                  <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800 mb-0.5">Application Approved!</p>
                    <p className="text-xs text-green-700">Your application has been approved. You are now an official Tri-M supplier. Our team will be in touch with your Supplier ID and onboarding details.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Application Timeline</p>
              <div className="space-y-3">
                {result.timeline.map((t, i) => (
                  <div key={t.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-violet-500 mt-1 shrink-0" />
                      {i < result.timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1 mb-0" />}
                    </div>
                    <div className="pb-3 last:pb-0">
                      <p className="text-xs font-semibold text-slate-700">{t.action}</p>
                      <p className="text-xs text-slate-400">{fmtDateTime(t.date)} · {t.actor}</p>
                      {t.note && <p className="text-xs text-slate-500 mt-0.5 italic">{t.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────────────────

const AdminLogin = ({ onLogin, onNav }: { onLogin: () => void; onNav: (p: Page) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin123") {
      setLoading(true);
      setTimeout(() => { onLogin(); setLoading(false); }, 600);
    } else {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2e1065] to-[#5b21b6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Layers size={28} className="text-violet-300" />
          </div>
          <h1 className="text-xl font-bold text-white">Tri-M Admin Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Vendor Management System</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sign In</h2>
          <p className="text-xs text-slate-500 mb-5">Access the Vendor Management Dashboard</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Username">
              <input className={inp} value={username} onChange={e => { setUsername(e.target.value); setError(""); }}
                placeholder="admin" autoComplete="username" />
            </Field>
            <Field label="Password">
              <input type="password" className={inp} value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••" autoComplete="current-password" />
            </Field>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}
            <button type="submit" disabled={loading || !username || !password}
              className="w-full py-2.5 text-sm font-bold bg-[#5b21b6] text-white rounded-lg hover:bg-[#4c1d95] transition-colors disabled:opacity-60 flex items-center gap-2 justify-center">
              {loading ? <><RefreshCw size={15} className="animate-spin" />Signing in...</> : <><Lock size={15} />Sign In</>}
            </button>
          </form>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Demo Credentials</p>
            <p className="text-xs text-slate-600 font-mono">Username: <strong>admin</strong></p>
            <p className="text-xs text-slate-600 font-mono">Password: <strong>admin123</strong></p>
          </div>
        </div>

        <button onClick={() => onNav("home")} className="mt-4 text-xs text-slate-400 hover:text-violet-300 flex items-center gap-1 mx-auto">
          <ArrowLeft size={12} /> Back to public site
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// ADMIN SIDEBAR
// ─────────────────────────────────────────────────────────

type NavItem = { icon: React.ReactNode; label: string; page: Page; };

const ADMIN_NAV: NavItem[] = [
  { icon: <BarChart2 size={17} />, label: "Vendor Dashboard", page: "admin-vendor" },
  { icon: <UserCheck size={17} />, label: "Supplier Management", page: "admin-suppliers" },
  { icon: <Award size={17} />, label: "Supplier Evaluation", page: "admin-evaluation" },
  { icon: <TrendingUp size={17} />, label: "Performance Monitoring", page: "admin-performance" },
  { icon: <Bell size={17} />, label: "Notifications", page: "admin-notifications" },
  { icon: <Shield size={17} />, label: "Audit Logs", page: "admin-audit" },
];

const AdminLayout = ({
  page, children, onNav, onLogout, notifCount
}: { page: Page; children: React.ReactNode; onNav: (p: Page) => void; onLogout: () => void; notifCount: number }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : ""}`}>
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-400/20 border border-violet-400/30 flex items-center justify-center shrink-0">
            <Layers size={16} className="text-violet-300" />
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-bold text-white tracking-wide">TRI-M GLOBAL</div>
            <div className="text-[10px] text-slate-400 tracking-wider">VENDOR MANAGEMENT</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {ADMIN_NAV.map(({ icon, label, page: navPage }) => (
          <button key={navPage}
            onClick={() => { onNav(navPage); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${page === navPage ? "bg-violet-500/20 text-violet-300 border border-violet-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            {icon}
            <span className="flex-1">{label}</span>
            {navPage === "admin-notifications" && notifCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{notifCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs">JC</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Juan dela Cruz</p>
            <p className="text-[10px] text-slate-400 truncate">Procurement Admin</p>
          </div>
        </div>
        <button onClick={() => { onLogout(); setMobileOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-60 bg-sidebar flex-col shrink-0 border-r border-sidebar-border">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-sidebar flex flex-col z-10">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-800">
              <Menu size={20} />
            </button>
            <h2 className="font-bold text-slate-800 text-sm">
              {ADMIN_NAV.find(n => n.page === page)?.label ?? "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNav("admin-notifications")} className="relative p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell size={18} />
              {notifCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
            <button onClick={() => onNav("home")} className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors" title="Public site">
              <Globe size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// VENDOR DASHBOARD
// ─────────────────────────────────────────────────────────

const VendorDashboard = ({
  applications, onView, onMarkUnderReview
}: {
  applications: SupplierApplication[];
  onView: (id: string) => void;
  onMarkUnderReview: (id: string) => void;
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppStatus | "">("");
  const [catFilter, setCatFilter] = useState("");
  const [sortField, setSortField] = useState<"submittedAt" | "companyName">("submittedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const kpis = {
    total: applications.length,
    pending: applications.filter(a => a.status === "pending_review").length,
    under: applications.filter(a => a.status === "under_review").length,
    approved: applications.filter(a => a.status === "approved").length,
    rejected: applications.filter(a => a.status === "rejected").length,
    revision: applications.filter(a => a.status === "revision_required").length,
  };

  const filtered = applications
    .filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !q || a.companyName.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) ||
        a.contactName.toLowerCase().includes(q);
      const matchStatus = !statusFilter || a.status === statusFilter;
      const matchCat = !catFilter || a.products.some(p => p.category === catFilter);
      return matchSearch && matchStatus && matchCat;
    })
    .sort((a, b) => {
      const v = sortField === "submittedAt"
        ? new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        : a.companyName.localeCompare(b.companyName);
      return sortDir === "asc" ? v : -v;
    });

  useEffect(() => { setPage(1); }, [search, statusFilter, catFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronDown size={13} className="opacity-30" />;

  const categoriesOf = (a: SupplierApplication) =>
    [...new Set(a.products.map(p => p.category))].filter(Boolean);

  const renderActions = (app: SupplierApplication) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onView(app.id)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#5b21b6] text-white rounded-lg hover:bg-[#4c1d95] transition-colors">
        <Eye size={12} /> View
      </button>
      {app.status === "pending_review" && (
        <button onClick={() => onMarkUnderReview(app.id)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
          <Eye size={12} /> Review
        </button>
      )}
    </div>
  );

  const Pagination = () => (
    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-slate-500">
        Showing {paged.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} application{filtered.length !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
          className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => setPage(n)}
            className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${n === currentPage ? "bg-[#5b21b6] text-white" : "border border-slate-200 hover:bg-slate-100"}`}>{n}</button>
        ))}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
          className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard icon={<FileText size={20} className="text-slate-600" />} label="Total" value={kpis.total} color="bg-slate-100" />
        <KpiCard icon={<Clock size={20} className="text-amber-600" />} label="Pending Review" value={kpis.pending} color="bg-amber-100" />
        <KpiCard icon={<Eye size={20} className="text-violet-600" />} label="Under Review" value={kpis.under} color="bg-violet-100" />
        <KpiCard icon={<CheckCircle size={20} className="text-green-600" />} label="Approved" value={kpis.approved} color="bg-green-100" />
        <KpiCard icon={<XCircle size={20} className="text-red-600" />} label="Rejected" value={kpis.rejected} color="bg-red-100" />
        <KpiCard icon={<AlertTriangle size={20} className="text-orange-600" />} label="Revision Req." value={kpis.revision} color="bg-orange-100" />
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9 w-full`} placeholder="Search by company, ID, or contact…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <select className={`${selectCls} pr-8 w-auto text-sm`} value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as AppStatus | "")}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <Filter size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select className={`${selectCls} pr-8 w-auto text-sm`} value={catFilter}
                onChange={e => setCatFilter(e.target.value)}>
                <option value="">All Categories</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Filter size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort("companyName")} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                    Application <SortIcon field="companyName" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Category</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort("submittedAt")} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                    Date <SortIcon field="submittedAt" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-slate-400">No applications match your search criteria.</td></tr>
              ) : paged.map(app => (
                <tr key={app.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800 mb-0.5">{app.companyName}</p>
                    <MonoId id={app.id} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-700">{app.contactName}</p>
                    <p className="text-xs text-slate-400">{app.contactPosition}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {categoriesOf(app).map(c => (
                        <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-600">{fmtDate(app.submittedAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3">
                    {renderActions(app)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {paged.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No applications match your search criteria.</div>
          ) : paged.map(app => (
            <div key={app.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{app.companyName}</p>
                  <MonoId id={app.id} />
                </div>
                <StatusBadge status={app.status} />
              </div>
              <div className="grid grid-cols-3 gap-y-1 text-xs">
                <span className="text-slate-400">Contact</span>
                <span className="col-span-2 text-slate-700 text-right truncate">{app.contactName} · {app.contactPosition}</span>
                <span className="text-slate-400">Category</span>
                <span className="col-span-2 text-slate-700 text-right truncate">{categoriesOf(app).join(", ") || "—"}</span>
                <span className="text-slate-400">Submitted</span>
                <span className="col-span-2 text-slate-700 text-right">{fmtDate(app.submittedAt)}</span>
              </div>
              <div className="pt-1">{renderActions(app)}</div>
            </div>
          ))}
        </div>

        <Pagination />
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// APPLICATION REVIEW
// ─────────────────────────────────────────────────────────

const AppReview = ({
  app, onBack, onApprove, onReject, onRevision, onMarkUnderReview
}: {
  app: SupplierApplication;
  onBack: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRevision: (id: string, note: string) => void;
  onMarkUnderReview: (id: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<"info" | "products" | "business" | "documents" | "timeline">("info");
  const [approveModal, setApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [revisionModal, setRevisionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [rejectErr, setRejectErr] = useState("");
  const [revisionErr, setRevisionErr] = useState("");

  const tabs = [
    { key: "info", label: "Company & Contact" },
    { key: "products", label: `Products (${app.products.length})` },
    { key: "business", label: "Business" },
    { key: "documents", label: `Documents (${app.documents.length})` },
    { key: "timeline", label: "Timeline" },
  ] as const;

  const handleReject = () => {
    if (!rejectReason.trim()) { setRejectErr("Rejection reason is required."); return; }
    onReject(app.id, rejectReason);
    setRejectModal(false);
  };

  const handleRevision = () => {
    if (!revisionNote.trim()) { setRevisionErr("Revision note is required."); return; }
    onRevision(app.id, revisionNote);
    setRevisionModal(false);
  };

  const canAction = app.status === "under_review" || app.status === "pending_review";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{app.companyName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <MonoId id={app.id} />
              <StatusBadge status={app.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto sm:flex-wrap sm:items-center">
          {app.status === "pending_review" && (
            <button onClick={() => onMarkUnderReview(app.id)}
              className="px-4 py-2 w-full sm:w-auto text-sm font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors flex items-center justify-center gap-2">
              <Eye size={15} /> Start Review
            </button>
          )}
          {canAction && (
            <>
              <button onClick={() => setRevisionModal(true)}
                className="px-4 py-2 w-full sm:w-auto text-sm font-semibold bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-2">
                <AlertTriangle size={15} /> Request Revision
              </button>
              <button onClick={() => setRejectModal(true)}
                className="px-4 py-2 w-full sm:w-auto text-sm font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <XCircle size={15} /> Reject
              </button>
              <button onClick={() => setApproveModal(true)}
                className="px-4 py-2 w-full sm:w-auto text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                <CheckCircle size={15} /> Approve
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status notices */}
      {app.status === "approved" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-600" />
          <p className="text-sm font-semibold text-green-800">This application has been approved. An official supplier record has been created.</p>
        </div>
      )}
      {app.status === "rejected" && app.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><XCircle size={16} className="text-red-600" /><span className="text-sm font-bold text-red-800">Rejected</span></div>
          <p className="text-sm text-red-700">{app.rejectionReason}</p>
        </div>
      )}
      {app.status === "revision_required" && app.revisionNote && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-orange-600" /><span className="text-sm font-bold text-orange-800">Revision Required</span></div>
          <p className="text-sm text-orange-700">{app.revisionNote}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === key ? "border-violet-500 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <SectionHeader icon={<Building2 size={16} />} title="Company Information" />
            <div className="space-y-3">
              {[
                { label: "Business Reg. No.", value: app.businessRegNo },
                { label: "TIN", value: app.tin, mono: true },
                { label: "Address", value: app.address },
                { label: "Email", value: app.email },
                { label: "Phone", value: app.phone },
                { label: "Website", value: app.website || "—" },
                { label: "Supplier Type", value: app.supplierType },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0 gap-4">
                  <span className="text-xs text-slate-500 shrink-0">{label}</span>
                  <span className={`text-xs font-medium text-slate-700 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <SectionHeader icon={<Users size={16} />} title="Contact Person" />
            <div className="space-y-3">
              {[
                { label: "Full Name", value: app.contactName },
                { label: "Position", value: app.contactPosition },
                { label: "Email", value: app.contactEmail },
                { label: "Phone", value: app.contactPhone },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0 gap-4">
                  <span className="text-xs text-slate-500 shrink-0">{label}</span>
                  <span className="text-xs font-medium text-slate-700 text-right">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-4">
          {app.products.map((p, i) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-slate-400 font-mono">PRODUCT {i + 1}</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p.category}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {[
                  { label: "Product Name", value: p.name },
                  { label: "Brand", value: p.brand || "—" },
                  { label: "Supply Capacity", value: p.supplyCapacity || "—" },
                  { label: "Min. Order Qty.", value: p.minOrderQty || "—" },
                  { label: "Price Range", value: p.priceRange || "—" },
                  { label: "Description", value: p.description || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className={label === "Description" ? "md:col-span-2" : ""}>
                    <span className="text-xs text-slate-400 block mb-0.5">{label}</span>
                    <span className="text-sm font-medium text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "business" && (
        <Card className="p-5">
          <SectionHeader icon={<Briefcase size={16} />} title="Business Information" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {[
              { label: "Years in Business", value: `${app.yearsInBusiness} year${app.yearsInBusiness === "1" ? "" : "s"}` },
              { label: "Payment Terms", value: app.paymentTerms },
              { label: "Lead Time", value: app.leadTime },
              { label: "Distribution Area", value: app.distributionArea },
              { label: "Delivery Capability", value: app.deliveryCapability || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <span className="text-xs text-slate-400 block mb-0.5">{label}</span>
                <span className="text-sm font-medium text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card className="p-5">
          <SectionHeader icon={<FileText size={16} />} title="Uploaded Documents" />
          {REQUIRED_DOCS.filter(d => !app.documents.find(doc => doc.type === d)).length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600" />
              <span className="text-xs text-amber-700 font-medium">
                Missing required documents: {REQUIRED_DOCS.filter(d => !app.documents.find(doc => doc.type === d)).join(", ")}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DOCUMENT_TYPES.map(dt => {
              const doc = app.documents.find(d => d.type === dt);
              const isRequired = REQUIRED_DOCS.includes(dt);
              return (
                <div key={dt} className={`flex items-center justify-between p-3 rounded-lg border ${doc ? "bg-green-50 border-green-200" : isRequired ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    {doc ? <CheckCircle size={15} className="text-green-500 shrink-0" /> : <XCircle size={15} className={`${isRequired ? "text-red-400" : "text-slate-300"} shrink-0`} />}
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{dt}{isRequired && !doc && <span className="text-red-500 ml-1">*Required</span>}</p>
                      {doc && <p className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">{doc.fileName}</p>}
                    </div>
                  </div>
                  {doc && doc.dataUrl && (
                    <a href={doc.dataUrl} download={doc.fileName}
                      className="p-1.5 text-slate-400 hover:text-violet-600 transition-colors rounded" title="Download">
                      <Download size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === "timeline" && (
        <Card className="p-5">
          <SectionHeader icon={<Activity size={16} />} title="Application Timeline" />
          <div className="space-y-4">
            {app.timeline.map((t, i) => (
              <div key={t.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-violet-600">{i + 1}</span>
                  </div>
                  {i < app.timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-2" style={{ minHeight: "24px" }} />}
                </div>
                <div className={`pb-4 ${i < app.timeline.length - 1 ? "" : ""}`}>
                  <p className="text-sm font-bold text-slate-800">{t.action}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(t.date)} · {t.actor}</p>
                  {t.note && <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded p-2 italic">{t.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Approve Modal */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="Approve Application">
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-green-800 mb-1">Confirm Approval</p>
                <p className="text-xs text-green-700">Approving this application will:</p>
                <ul className="text-xs text-green-700 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Generate an official Supplier ID</li>
                  <li>Create a Supplier record in Supplier Management</li>
                  <li>Make the supplier available for Evaluation and Performance Monitoring</li>
                  <li>Record this action in the Audit Log</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">Are you sure you want to approve <strong>{app.companyName}</strong>?</p>
          <div className="flex gap-3">
            <button onClick={() => setApproveModal(false)}
              className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={() => { onApprove(app.id); setApproveModal(false); }}
              className="flex-1 py-2 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 justify-center">
              <CheckCircle size={15} /> Approve
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => { setRejectModal(false); setRejectReason(""); setRejectErr(""); }} title="Reject Application">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700">This action will permanently reject <strong>{app.companyName}&apos;s</strong> application. The company will not be added to Supplier Management.</p>
          </div>
          <Field label="Rejection Reason" required error={rejectErr}>
            <textarea className={`${inp} resize-none`} rows={4} value={rejectReason}
              onChange={e => { setRejectReason(e.target.value); setRejectErr(""); }}
              placeholder="Explain why this application is being rejected. This reason will be recorded and may be communicated to the applicant." />
          </Field>
          <div className="flex gap-3">
            <button onClick={() => { setRejectModal(false); setRejectReason(""); setRejectErr(""); }}
              className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleReject}
              className="flex-1 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 justify-center">
              <XCircle size={15} /> Confirm Reject
            </button>
          </div>
        </div>
      </Modal>

      {/* Revision Modal */}
      <Modal open={revisionModal} onClose={() => { setRevisionModal(false); setRevisionNote(""); setRevisionErr(""); }} title="Request Revision">
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-orange-700">The applicant will be notified that their application requires revision. They must update and resubmit.</p>
          </div>
          <Field label="Revision Note" required error={revisionErr}
            hint="Clearly describe what needs to be corrected or submitted.">
            <textarea className={`${inp} resize-none`} rows={4} value={revisionNote}
              onChange={e => { setRevisionNote(e.target.value); setRevisionErr(""); }}
              placeholder="e.g. Please upload the missing Tax Registration Certificate (BIR Form 2303) and provide an updated Product Catalog with current pricing." />
          </Field>
          <div className="flex gap-3">
            <button onClick={() => { setRevisionModal(false); setRevisionNote(""); setRevisionErr(""); }}
              className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleRevision}
              className="flex-1 py-2 text-sm font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 justify-center">
              <AlertTriangle size={15} /> Request Revision
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// SUPPLIER MANAGEMENT
// ─────────────────────────────────────────────────────────

const SupplierManagement = ({ suppliers, onViewApp }: { suppliers: Supplier[]; onViewApp: (appId: string) => void }) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return !q || s.companyName.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q);
  });

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Supplier Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Official approved suppliers — automatically created upon application approval.</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <CheckCircle size={15} className="text-green-600" />
          <span className="text-sm font-semibold text-green-700">{suppliers.filter(s => s.status === "active").length} Active Suppliers</span>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9 w-full`} placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Eval. Score</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Performance</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-slate-400">No official suppliers yet. Approve supplier applications to add them here.</td></tr>
              ) : paged.map(s => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{s.companyName}</p>
                    <MonoId id={s.id} />
                    <p className="text-[10px] text-slate-400 mt-0.5">Since {fmtDate(s.approvedAt)}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{s.supplierType}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-700">{s.contactName}</p>
                    <p className="text-xs text-slate-400">{s.contactEmail}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 w-20">
                        <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${s.evaluationScore}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{s.evaluationScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Stars rating={s.performanceRating} />
                  </td>
                  <td className="px-4 py-3">
                    <SupStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => onViewApp(s.applicationId)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1">
                      <FileText size={12} /> View App
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {paged.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No official suppliers yet. Approve supplier applications to add them here.</div>
          ) : paged.map(s => (
            <div key={s.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.companyName}</p>
                  <MonoId id={s.id} />
                </div>
                <SupStatusBadge status={s.status} />
              </div>
              <div className="grid grid-cols-3 gap-y-1 text-xs">
                <span className="text-slate-400">Type</span>
                <span className="col-span-2 text-slate-700 text-right">{s.supplierType}</span>
                <span className="text-slate-400">Contact</span>
                <span className="col-span-2 text-slate-700 text-right truncate">{s.contactName}</span>
                <span className="text-slate-400">Eval. Score</span>
                <span className="col-span-2 text-slate-700 text-right">{s.evaluationScore}</span>
                <span className="text-slate-400">Performance</span>
                <span className="col-span-2 text-slate-700 text-right"><Stars rating={s.performanceRating} /></span>
              </div>
              <button onClick={() => onViewApp(s.applicationId)}
                className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">
                <FileText size={12} /> View Application
              </button>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">Showing {paged.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} supplier{filtered.length !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${n === currentPage ? "bg-[#5b21b6] text-white" : "border border-slate-200 hover:bg-slate-100"}`}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// SUPPLIER EVALUATION
// ─────────────────────────────────────────────────────────

const SupplierEvaluation = ({ suppliers }: { suppliers: Supplier[] }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const criteria = [
    { key: "quality", label: "Product Quality", weight: 30 },
    { key: "delivery", label: "Delivery Reliability", weight: 25 },
    { key: "pricing", label: "Pricing Competitiveness", weight: 20 },
    { key: "communication", label: "Communication & Responsiveness", weight: 15 },
    { key: "compliance", label: "Compliance & Documentation", weight: 10 },
  ];

  const handleSave = (suppId: string) => {
    setSaved(suppId);
    setTimeout(() => setSaved(null), 2000);
    setSelected(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Supplier Evaluation</h1>
        <p className="text-xs text-slate-500 mt-0.5">Assess and score active suppliers across key performance criteria.</p>
      </div>

      {suppliers.length === 0 ? (
        <Card className="p-12 text-center">
          <Award size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No approved suppliers yet. Suppliers will appear here once applications are approved.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {suppliers.map(s => (
            <Card key={s.id} className="overflow-hidden">
              <div className="p-5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#5b21b6]/10 flex items-center justify-center text-[#5b21b6] font-bold text-sm">
                    {s.companyName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{s.companyName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <MonoId id={s.id} />
                      <SupStatusBadge status={s.status} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-black text-slate-800">{s.evaluationScore}</p>
                    <p className="text-xs text-slate-500">Current Score</p>
                  </div>
                  <div className="text-center">
                    <Stars rating={s.performanceRating} />
                    <p className="text-xs text-slate-500 mt-0.5">Performance</p>
                  </div>
                  <button onClick={() => setSelected(selected === s.id ? null : s.id)}
                    className="px-4 py-2 text-sm font-semibold bg-[#5b21b6] text-white rounded-lg hover:bg-[#4c1d95] transition-colors flex items-center gap-2">
                    <ClipboardList size={14} /> Evaluate
                  </button>
                </div>
              </div>

              {selected === s.id && (
                <div className="border-t border-slate-100 p-5 bg-slate-50">
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Evaluation Form — {s.companyName}</h4>
                  <div className="space-y-4">
                    {criteria.map(c => (
                      <div key={c.key}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600">{c.label} <span className="text-slate-400">({c.weight}% weight)</span></span>
                          <span className="text-xs font-bold text-violet-600">{scores[`${s.id}-${c.key}`] ?? 0}/100</span>
                        </div>
                        <input type="range" min={0} max={100} step={5}
                          value={scores[`${s.id}-${c.key}`] ?? 0}
                          onChange={e => setScores(prev => ({ ...prev, [`${s.id}-${c.key}`]: Number(e.target.value) }))}
                          className="w-full accent-violet-500" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => setSelected(null)}
                      className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
                    <button onClick={() => handleSave(s.id)}
                      className="px-4 py-2 text-sm font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2">
                      {saved === s.id ? <><CheckCircle size={14} />Saved!</> : <><Download size={14} />Save Evaluation</>}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// PERFORMANCE MONITORING
// ─────────────────────────────────────────────────────────

const PerformanceMonitoring = ({ suppliers }: { suppliers: Supplier[] }) => (
  <div className="space-y-5">
    <div>
      <h1 className="text-lg font-bold text-slate-800">Supplier Performance Monitoring</h1>
      <p className="text-xs text-slate-500 mt-0.5">Track KPIs and performance metrics for all active official suppliers.</p>
    </div>

    {suppliers.length === 0 ? (
      <Card className="p-12 text-center">
        <TrendingUp size={40} className="text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No approved suppliers to monitor yet.</p>
      </Card>
    ) : (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={<TrendingUp size={20} className="text-violet-600" />} label="Active Suppliers" value={suppliers.filter(s => s.status === "active").length} color="bg-violet-100" />
          <KpiCard icon={<Star size={20} className="text-amber-600" />} label="Avg. Performance" value={Math.round(suppliers.reduce((sum, s) => sum + s.performanceRating, 0) / suppliers.length * 10) / 10} color="bg-amber-100" />
          <KpiCard icon={<Award size={20} className="text-green-600" />} label="Avg. Eval. Score" value={Math.round(suppliers.reduce((sum, s) => sum + s.evaluationScore, 0) / suppliers.length)} color="bg-green-100" />
        </div>

        <Card>
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Performance Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Eval. Score</th>
                  <th className="text-left px-4 py-3">Performance</th>
                  <th className="text-left px-4 py-3">Last Evaluated</th>
                  <th className="text-left px-4 py-3">Trend</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800">{s.companyName}</p>
                      <MonoId id={s.id} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s.supplierType}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${s.evaluationScore >= 80 ? "bg-green-500" : s.evaluationScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${s.evaluationScore}%` }} />
                        </div>
                        <span className="text-sm font-bold text-slate-700">{s.evaluationScore}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Stars rating={s.performanceRating} />
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-500">{fmtDate(s.lastEvaluated)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp size={14} />
                        <span className="text-xs font-semibold">+4.2%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────

const NotificationsPage = ({ notifications, onMarkRead, onMarkAllRead }: {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) => {
  const unread = notifications.filter(n => !n.read).length;
  const typeIcon = (t: AppNotification["type"]) => ({
    info: <Info size={16} className="text-violet-500" />,
    success: <CheckCircle size={16} className="text-green-500" />,
    warning: <AlertTriangle size={16} className="text-amber-500" />,
    error: <XCircle size={16} className="text-red-500" />,
  })[t];
  const typeBg = (t: AppNotification["type"]) => ({
    info: "bg-violet-50 border-violet-200",
    success: "bg-green-50 border-green-200",
    warning: "bg-amber-50 border-amber-200",
    error: "bg-red-50 border-red-200",
  })[t];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Notifications</h1>
          <p className="text-xs text-slate-500 mt-0.5">{unread} unread notification{unread !== 1 ? "s" : ""}</p>
        </div>
        {unread > 0 && (
          <button onClick={onMarkAllRead}
            className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
            <CheckCircle2 size={14} /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id}
              className={`p-4 rounded-xl border flex items-start gap-4 transition-all cursor-pointer hover:shadow-sm ${n.read ? "bg-white border-slate-200 opacity-70" : `${typeBg(n.type)} shadow-sm`}`}
              onClick={() => onMarkRead(n.id)}>
              <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────

const AuditLogs = ({ logs }: { logs: AuditLog[] }) => {
  const [search, setSearch] = useState("");

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !q || l.action.toLowerCase().includes(q) || l.entityId.toLowerCase().includes(q) ||
      l.actor.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
  });

  const actionColor = (action: string) => {
    if (action.includes("APPROVED") || action.includes("CREATED")) return "bg-green-100 text-green-700";
    if (action.includes("REJECTED")) return "bg-red-100 text-red-700";
    if (action.includes("REVISION")) return "bg-orange-100 text-orange-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Audit Logs</h1>
        <p className="text-xs text-slate-500 mt-0.5">Complete trail of all system actions and administrative decisions.</p>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Entity ID</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Actor</th>
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-sm text-slate-400">No audit logs match your search.</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-mono ${actionColor(l.action)}`}>{l.action}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <MonoId id={l.entityId} />
                    <p className="text-[11px] text-slate-400 mt-0.5">{l.entity}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs text-slate-700">{l.actor}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-600">{fmtDateTime(l.timestamp)}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                    <p className="text-xs text-slate-500 truncate">{l.details}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500">Showing {filtered.length} of {logs.length} audit entries</p>
        </div>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// URL / HISTORY SYNC (uses the existing navigation system)
// ─────────────────────────────────────────────────────────

// Public pages use pure state-based navigation (no URL/hash change).
// Admin pages keep their hash routes so deep-linking/back still work.
const PUBLIC_PAGES = new Set<Page>(["home", "apply", "apply-success", "status"]);

const pageToHash = (p: Page): string => {
  switch (p) {
    case "admin-login": return "#/admin";
    case "admin-vendor": return "#/admin/applications";
    case "admin-review": return "#/admin/review";
    case "admin-suppliers": return "#/admin/suppliers";
    case "admin-evaluation": return "#/admin/evaluation";
    case "admin-performance": return "#/admin/performance";
    case "admin-notifications": return "#/admin/notifications";
    case "admin-audit": return "#/admin/audit";
    default: return "#/";
  }
};

// Only admin hashes are honored on direct load; public pages are URL-independent.
const hashToPage = (h: string): Page => {
  switch (h) {
    case "#/admin": return "admin-login";
    case "#/admin/applications": return "admin-vendor";
    case "#/admin/review": return "admin-review";
    case "#/admin/suppliers": return "admin-suppliers";
    case "#/admin/evaluation": return "admin-evaluation";
    case "#/admin/performance": return "admin-performance";
    case "#/admin/notifications": return "admin-notifications";
    case "#/admin/audit": return "admin-audit";
    default: return "home";
  }
};

// ─────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>(() => hashToPage(window.location.hash || "#/"));
  const [applications, setApplications] = usePersisted(LS_KEYS.apps, INIT_APPS);
  const [suppliers, setSuppliers] = usePersisted(LS_KEYS.suppliers, INIT_SUPPLIERS);
  const [auditLogs, setAuditLogs] = usePersisted(LS_KEYS.audit, INIT_AUDIT);
  const [notifications, setNotifications] = usePersisted(LS_KEYS.notifs, INIT_NOTIFS);
  const [isAdmin, setIsAdmin] = usePersisted(LS_KEYS.auth, false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [latestApp, setLatestApp] = useState<SupplierApplication | null>(null);
  const [editingApp, setEditingApp] = useState<SupplierApplication | null>(null);

  const navigate = (p: Page, appId?: string) => {
    setPage(p);
    if (appId !== undefined) setSelectedAppId(appId);
    if (p !== "apply") setEditingApp(null);
    if (PUBLIC_PAGES.has(p)) {
      // Public pages: stay on the same URL (no hash/route change).
      window.history.pushState({ page: p }, "", window.location.pathname + window.location.search);
    } else {
      const hash = pageToHash(p);
      if (window.location.hash !== hash) window.history.pushState({ page: p }, "", hash);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const p = (e.state && e.state.page) ? e.state.page as Page : hashToPage(window.location.hash || "#/");
      setPage(p);
      if (p !== "apply") setEditingApp(null);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Scroll-reveal: observe any `.reveal` elements in the active page and
  // add `.in` when they enter the viewport. Re-scans whenever the page
  // changes (public pages mount fresh). Reduced-motion is handled in CSS.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window) || els.length === 0) {
      els.forEach(el => el.classList.add("in"));
      return;
    }
    const reveal = (el: HTMLElement) => el.classList.add("in");
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          reveal(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(el => io.observe(el));

    // Fallback for fast scrolling / skipped frames: reveal anything already
    // at or above the viewport bottom on scroll.
    const onScroll = () => {
      const vh = window.innerHeight;
      els.forEach(el => {
        if (!el.classList.contains("in") && el.getBoundingClientRect().top < vh) reveal(el);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [page]);

  const addAuditLog = (log: Omit<AuditLog, "id">) => {
    setAuditLogs(prev => [{ ...log, id: `AL-${Date.now()}` }, ...prev]);
  };

  const addNotification = (n: Omit<AppNotification, "id" | "read" | "timestamp">) => {
    setNotifications(prev => [{ ...n, id: `N-${Date.now()}`, read: false, timestamp: now() }, ...prev]);
  };

  const updateApp = (id: string, patch: Partial<SupplierApplication>, timelineEntry?: Omit<TimelineEntry, "id">) => {
    setApplications(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, ...patch, updatedAt: now() };
      if (timelineEntry) updated.timeline = [...a.timeline, { ...timelineEntry, id: `t${Date.now()}` }];
      return updated;
    }));
  };

  const handleSubmitApp = (app: SupplierApplication) => {
    setApplications(prev => [app, ...prev]);
    setLatestApp(app);
    addNotification({ title: "New Application Received", message: `${app.companyName} submitted a new supplier application (${app.id}).`, type: "info" });
    navigate("apply-success");
  };

  const handleMarkUnderReview = (id: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    updateApp(id, { status: "under_review" }, { action: "Status changed to Under Review", date: now(), actor: "Admin: Juan dela Cruz" });
    addAuditLog({ action: "APPLICATION_STATUS_CHANGED", entity: "SupplierApplication", entityId: id, actor: "Admin: Juan dela Cruz", timestamp: now(), details: `Status changed from ${STATUS_CFG[app.status].label} to Under Review.` });
    addNotification({ title: "Application Under Review", message: `${app.companyName} application (${id}) is now under review.`, type: "info" });
  };

  const handleApprove = (id: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    const suppId = genId("SUP");
    const sup: Supplier = {
      id: suppId,
      applicationId: id,
      companyName: app.companyName,
      contactName: app.contactName,
      contactEmail: app.contactEmail,
      contactPhone: app.contactPhone,
      supplierType: app.supplierType as SupplierType,
      products: app.products,
      address: app.address,
      email: app.email,
      phone: app.phone,
      website: app.website,
      distributionArea: app.distributionArea,
      yearsInBusiness: app.yearsInBusiness,
      status: "active",
      approvedAt: now(),
      evaluationScore: 0,
      performanceRating: 0,
      lastEvaluated: now(),
    };
    setSuppliers(prev => [...prev, sup]);
    updateApp(id, { status: "approved" }, { action: "Application Approved", date: now(), actor: "Admin: Juan dela Cruz", note: `All requirements met. Supplier ID ${suppId} generated and added to Supplier Management.` });
    addAuditLog({ action: "APPLICATION_APPROVED", entity: "SupplierApplication", entityId: id, actor: "Admin: Juan dela Cruz", timestamp: now(), details: `Application approved. Supplier record created: ${suppId}.` });
    addAuditLog({ action: "SUPPLIER_CREATED", entity: "Supplier", entityId: suppId, actor: "System", timestamp: now(), details: `Official supplier record auto-generated from application ${id}.` });
    addNotification({ title: "Supplier Approved", message: `${app.companyName} approved as official supplier (${suppId}).`, type: "success" });
  };

  const handleReject = (id: string, reason: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    updateApp(id, { status: "rejected", rejectionReason: reason }, { action: "Application Rejected", date: now(), actor: "Admin: Juan dela Cruz", note: reason });
    addAuditLog({ action: "APPLICATION_REJECTED", entity: "SupplierApplication", entityId: id, actor: "Admin: Juan dela Cruz", timestamp: now(), details: `Rejected: ${reason}` });
    addNotification({ title: "Application Rejected", message: `${app.companyName} application (${id}) has been rejected.`, type: "error" });
  };

  const handleRevision = (id: string, note: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    updateApp(id, { status: "revision_required", revisionNote: note }, { action: "Revision Required", date: now(), actor: "Admin: Juan dela Cruz", note });
    addAuditLog({ action: "REVISION_REQUIRED", entity: "SupplierApplication", entityId: id, actor: "Admin: Juan dela Cruz", timestamp: now(), details: `Revision required: ${note}` });
    addNotification({ title: "Revision Required", message: `${app.companyName} (${id}) notified to revise application.`, type: "warning" });
  };

  const handleResubmit = (id: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    setEditingApp(app);
    navigate("apply");
  };

  const handleUpdateApp = (app: SupplierApplication) => {
    setApplications(prev => prev.map(a => a.id === app.id ? app : a));
    setLatestApp(app);
    addNotification({ title: "Application Resubmitted", message: `${app.companyName} has resubmitted application ${app.id} for review.`, type: "info" });
    navigate("apply-success");
  };

  const handleMarkRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const handleMarkAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const unreadCount = notifications.filter(n => !n.read).length;
  const selectedApp = applications.find(a => a.id === selectedAppId);

  // Public pages
  if (page === "home") return <div key={page} className="page-enter"><HomePage onNav={navigate} /></div>;
  if (page === "apply") return <div key={page} className="page-enter"><ApplyForm onSubmit={handleSubmitApp} initialApp={editingApp} onUpdate={handleUpdateApp} onNav={navigate} current="apply" /></div>;
  if (page === "apply-success") {
    if (latestApp) return <div key={page} className="page-enter"><ApplySuccess app={latestApp} onNav={navigate} current="apply-success" /></div>;
    return <div key={page} className="page-enter"><HomePage onNav={navigate} /></div>;
  }
  if (page === "status") return <div key={page} className="page-enter"><StatusCheck applications={applications} onNav={navigate} onResubmit={handleResubmit} current="status" /></div>;

  // Admin login
  if (!isAdmin || page === "admin-login") {
    return <AdminLogin onLogin={() => { setIsAdmin(true); navigate("admin-vendor"); }} onNav={navigate} />;
  }

  // Admin pages
  const handleViewApp = (id: string) => navigate("admin-review", id);
  const handleViewAppFromSupplier = (appId: string) => navigate("admin-review", appId);

  return (
    <AdminLayout page={page} onNav={navigate} onLogout={() => { setIsAdmin(false); navigate("home"); }} notifCount={unreadCount}>
      {page === "admin-vendor" && (
        <VendorDashboard
          applications={applications}
          onView={handleViewApp}
          onMarkUnderReview={handleMarkUnderReview}
        />
      )}

      {page === "admin-review" && selectedApp && (
        <AppReview
          app={selectedApp}
          onBack={() => navigate("admin-vendor")}
          onApprove={handleApprove}
          onReject={handleReject}
          onRevision={handleRevision}
          onMarkUnderReview={handleMarkUnderReview}
        />
      )}

      {page === "admin-review" && !selectedApp && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle size={32} className="text-slate-300" />
          <p className="text-sm text-slate-500">Application not found.</p>
          <button onClick={() => navigate("admin-vendor")}
            className="px-4 py-2 text-sm font-semibold bg-[#5b21b6] text-white rounded-lg hover:bg-[#4c1d95]">
            Back to Dashboard
          </button>
        </div>
      )}

      {page === "admin-suppliers" && (
        <SupplierManagement suppliers={suppliers} onViewApp={handleViewAppFromSupplier} />
      )}

      {page === "admin-evaluation" && (
        <SupplierEvaluation suppliers={suppliers} />
      )}

      {page === "admin-performance" && (
        <PerformanceMonitoring suppliers={suppliers} />
      )}

      {page === "admin-notifications" && (
        <NotificationsPage notifications={notifications} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} />
      )}

      {page === "admin-audit" && (
        <AuditLogs logs={auditLogs} />
      )}
    </AdminLayout>
  );
}
