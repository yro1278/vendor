import { Dispatch, SetStateAction, useState } from "react";

/* ─────────────────────────────────────────────────────────
   TRI-M GLOBAL LOGISTICS & TRADING INC.
   Vendor Management — shared receiving & monitoring layer

   This module is a DOWNSTREAM subsystem of the Supply Chain
   subsystem. The Supply Chain subsystem is responsible for
   supplier sourcing, selection, and procurement. It passes the
   resulting supplier information and supply schedules to this
   module, which RECEIVES, RECORDS, and MONITORS the incoming
   supply. This module does NOT find, recruit, or approve new
   suppliers.
   ───────────────────────────────────────────────────────── */

export type SupplierType = "Manufacturer" | "Distributor" | "Wholesaler" | "Importer" | "Other";
export type ProductCategory = "Dry Products" | "Frozen Products" | "Cosmetic Products" | "Packaging" | "General Merchandise";

export type SupplyStatus =
  | "expected"
  | "for_receiving"
  | "received"
  | "partially_received"
  | "completed"
  | "rejected_damaged";

export type ReceiptCondition = "good" | "damaged" | "rejected";

export interface Product {
  id: string;
  name: string;
  description: string;
  brand: string;
  category: ProductCategory | "";
}

/* Supplier record as provided by the Supply Chain subsystem.
   Sourcing and selection decisions happen upstream — the vendor
   module only views and monitors these records. */
export interface Supplier {
  id: string;
  sourceRef: string;              /* Reference from the Supply Chain subsystem */
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  supplierType: SupplierType;
  products: Product[];            /* Products / supplies provided to Tri-M */
  address: string;
  email: string;
  phone: string;
  website: string;
  distributionArea: string;
  status: "active" | "inactive";  /* Operational relationship status (monitoring) */
  establishedOn: string;          /* When the Supply Chain subsystem established the relationship */
}

export interface SupplyItem {
  productName: string;
  qty: number;
  unit: string;
}

/* Expected / pending supply notified by the Supply Chain subsystem.
   Staff receive these and turn them into receiving transactions. */
export interface SupplyArrival {
  id: string;                     /* e.g. SC-DLV-2026-xxxx (upstream delivery reference) */
  sourceRef: string;              /* e.g. SC-SCHED-2026-xxxx (Supply Chain schedule ref) */
  supplierId: string;
  supplierName: string;
  items: SupplyItem[];
  totalQty: number;
  expectedDate: string;           /* expected delivery date (ISO date) */
  expectedTime: string;           /* e.g. "10:00 AM" */
  destination: string;            /* receiving site / warehouse */
  remarks: string;
  status: SupplyStatus;
  createdAt: string;
}

export interface ReceiptItem {
  productName: string;
  qty: number;
  unit: string;
  condition: ReceiptCondition;
}

/* A receiving transaction — the core record of this module. */
export interface SupplyReceipt {
  id: string;                     /* RR-YYYY-xxxxx — Receiving Reference No. */
  arrivalId: string;              /* Linked expected supply (may be empty for ad-hoc receipts) */
  supplierId: string;
  supplierName: string;
  items: ReceiptItem[];
  totalQty: number;
  receivedAt: string;             /* date + time received */
  receivingBy: string;
  docRef: string;                 /* document / reference number (delivery receipt, waybill, DR no.) */
  remarks: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  timestamp: string;
}

/* ── constants ─────────────────────────────────────────── */

export const SUPPLIER_TYPES: SupplierType[] = ["Manufacturer", "Distributor", "Wholesaler", "Importer", "Other"];
export const PRODUCT_CATEGORIES: ProductCategory[] = ["Dry Products", "Frozen Products", "Cosmetic Products", "Packaging", "General Merchandise"];
export const UNIT_OPTIONS = ["pcs", "box", "case", "sack", "bag", "kg", "L", "pack", "pallet"];

export const SUPPLY_STATUS_CFG: Record<SupplyStatus, { label: string; cls: string; dot: string }> = {
  expected:           { label: "Expected",           cls: "bg-sky-50 text-sky-700 border-sky-200",    dot: "bg-sky-500" },
  for_receiving:      { label: "For Receiving",      cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  received:           { label: "Received",           cls: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  partially_received: { label: "Partially Received", cls: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  completed:          { label: "Completed",          cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  rejected_damaged:   { label: "Rejected / Damaged", cls: "bg-red-50 text-red-700 border-red-200",    dot: "bg-red-500" },
};

export const CONDITION_LABEL: Record<ReceiptCondition, string> = {
  good: "Good",
  damaged: "Damaged",
  rejected: "Rejected",
};

/* ── utils ─────────────────────────────────────────────── */

export const now = () => new Date().toISOString();
export const genId = (pfx: string) => `${pfx}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

export const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

export const fmtDateTime = (s: string) =>
  s ? new Date(s).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtTime = (s: string) => {
  if (!s) return "—";
  const d = new Date(`${s.slice(0, 10)}T${s.slice(11)}`);
  if (isNaN(+d)) return s;
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
};

export const arrivalReceivedQty = (arrivalId: string, receipts: SupplyReceipt[]) =>
  receipts.filter(r => r.arrivalId === arrivalId).reduce((a, r) => a + r.totalQty, 0);

export const arrivalHasIssue = (arrivalId: string, receipts: SupplyReceipt[]) =>
  receipts.some(r => r.arrivalId === arrivalId && r.items.some(i => i.condition !== "good"));

export const receiptHasIssue = (rec: SupplyReceipt) => rec.items.some(i => i.condition !== "good");

export const supplierReceivedQty = (supplierId: string, receipts: SupplyReceipt[]) =>
  receipts.filter(r => r.supplierId === supplierId).reduce((a, r) => a + r.totalQty, 0);

const day = (offset: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/* ── seed data (mock — mirrors data that the Supply Chain
      subsystem would pass downstream) ──────────────────── */

const BEAUTY_PRODUCTS: Product[] = [
  { id: "p1", name: "Korean BB Cream SPF 50+", description: "Multi-function BB cream with sun protection and moisturizing formula.", brand: "GlowKor", category: "Cosmetic Products" },
  { id: "p2", name: "Hyaluronic Acid Serum 30ml", description: "2% HA serum with panthenol and ceramide complex for intense hydration.", brand: "GlowKor", category: "Cosmetic Products" },
  { id: "p3", name: "Matte Lipstick Trio", description: "Long-wear matte lipstick set in three shades.", brand: "GlowKor", category: "Cosmetic Products" },
];

const PACIFIC_PRODUCTS: Product[] = [
  { id: "p4", name: "Premium Jasmine Rice 25kg", description: "Premium long-grain jasmine rice in sealed 25kg sacks.", brand: "Pacific Dry", category: "Dry Products" },
  { id: "p5", name: "Canned Sardines 155g", description: "Canned sardines in tomato sauce, 155g.", brand: "Pacific Dry", category: "Dry Products" },
];

const FRESH_PRODUCTS: Product[] = [
  { id: "p6", name: "Premium Frozen Tilapia Fillet", description: "Grade A frozen tilapia fillets, IQF processed, sizes 100–200g.", brand: "Pacific Fresh", category: "Frozen Products" },
  { id: "p7", name: "Frozen Shrimp Vannamei (HLSO)", description: "Head-less shell-on frozen shrimp, various count sizes available.", brand: "Pacific Fresh", category: "Frozen Products" },
];

const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "SUP-2026-10001", sourceRef: "SCSUP-2026-0140",
    companyName: "BeautyPH Cosmetics Inc.", contactName: "Ana Reyes",
    contactEmail: "a.reyes@beautyphcosmetics.com", contactPhone: "+63 920 543 2109",
    supplierType: "Importer", products: BEAUTY_PRODUCTS,
    address: "78 Shaw Blvd, Mandaluyong City, Metro Manila", email: "sales@beautyphcosmetics.com",
    phone: "+63 2 6666 3333", website: "www.beautyphcosmetics.com",
    distributionArea: "Metro Manila, Cebu, Davao",
    status: "active", establishedOn: day(-100),
  },
  {
    id: "SUP-2026-10032", sourceRef: "SCSUP-2026-0131",
    companyName: "Pacific Dry Goods Trading", contactName: "Marco Santos",
    contactEmail: "marco@pacificdry.ph", contactPhone: "+63 917 812 3456",
    supplierType: "Wholesaler", products: PACIFIC_PRODUCTS,
    address: "12 Harbor Drive, Port Area, Manila", email: "marco@pacificdry.ph",
    phone: "+63 2 8888 1111", website: "www.pacificdry.ph",
    distributionArea: "Metro Manila, Luzon",
    status: "active", establishedOn: day(-80),
  },
  {
    id: "SUP-2026-10045", sourceRef: "SCSUP-2026-0156",
    companyName: "Pacific Fresh Distributors Inc.", contactName: "Maria Santos",
    contactEmail: "maria.santos@pacificfresh.ph", contactPhone: "+63 917 123 4567",
    supplierType: "Distributor", products: FRESH_PRODUCTS,
    address: "45 Macapagal Blvd, Pasay City, Metro Manila", email: "info@pacificfresh.ph",
    phone: "+63 2 8888 5555", website: "www.pacificfresh.ph",
    distributionArea: "Metro Manila, Luzon",
    status: "active", establishedOn: day(-45),
  },
];

const SEED_ARRIVALS: SupplyArrival[] = [
  {
    id: "SC-DLV-2026-0311", sourceRef: "SC-SCHED-2026-0311",
    supplierId: "SUP-2026-10001", supplierName: "BeautyPH Cosmetics Inc.",
    items: [
      { productName: "Korean BB Cream SPF 50+", qty: 200, unit: "pcs" },
      { productName: "Hyaluronic Acid Serum 30ml", qty: 120, unit: "pcs" },
    ],
    totalQty: 320, expectedDate: day(-1).slice(0, 10), expectedTime: "10:00 AM",
    destination: "Tri-M MDC — Warehouse A", remarks: "",
    status: "completed", createdAt: day(-6),
  },
  {
    id: "SC-DLV-2026-0334", sourceRef: "SC-SCHED-2026-0334",
    supplierId: "SUP-2026-10032", supplierName: "Pacific Dry Goods Trading",
    items: [{ productName: "Premium Jasmine Rice 25kg", qty: 100, unit: "sack" }],
    totalQty: 100, expectedDate: day(0).slice(0, 10), expectedTime: "9:00 AM",
    destination: "Tri-M MDC — Warehouse A", remarks: "Delivery truck arrived at site.",
    status: "for_receiving", createdAt: day(-2),
  },
  {
    id: "SC-DLV-2026-0338", sourceRef: "SC-SCHED-2026-0338",
    supplierId: "SUP-2026-10045", supplierName: "Pacific Fresh Distributors Inc.",
    items: [
      { productName: "Premium Frozen Tilapia Fillet", qty: 300, unit: "kg" },
      { productName: "Frozen Shrimp Vannamei (HLSO)", qty: 200, unit: "kg" },
    ],
    totalQty: 500, expectedDate: day(1).slice(0, 10), expectedTime: "8:30 AM",
    destination: "Tri-M MDC — Cold Storage", remarks: "",
    status: "expected", createdAt: day(-1),
  },
  {
    id: "SC-DLV-2026-0298", sourceRef: "SC-SCHED-2026-0298",
    supplierId: "SUP-2026-10032", supplierName: "Pacific Dry Goods Trading",
    items: [{ productName: "Canned Sardines 155g", qty: 2000, unit: "pcs" }],
    totalQty: 2000, expectedDate: day(-3).slice(0, 10), expectedTime: "2:00 PM",
    destination: "Tri-M MDC — Warehouse A", remarks: "Balance of 500 pcs pending from supplier.",
    status: "partially_received", createdAt: day(-4),
  },
  {
    id: "SC-DLV-2026-0287", sourceRef: "SC-SCHED-2026-0287",
    supplierId: "SUP-2026-10001", supplierName: "BeautyPH Cosmetics Inc.",
    items: [{ productName: "Matte Lipstick Trio", qty: 120, unit: "pcs" }],
    totalQty: 120, expectedDate: day(-2).slice(0, 10), expectedTime: "11:00 AM",
    destination: "Tri-M MDC — Warehouse A", remarks: "Physical count verified.",
    status: "received", createdAt: day(-3),
  },
  {
    id: "SC-DLV-2026-0272", sourceRef: "SC-SCHED-2026-0272",
    supplierId: "SUP-2026-10045", supplierName: "Pacific Fresh Distributors Inc.",
    items: [{ productName: "Frozen Shrimp Vannamei (HLSO)", qty: 150, unit: "kg" }],
    totalQty: 150, expectedDate: day(-4).slice(0, 10), expectedTime: "7:30 AM",
    destination: "Tri-M MDC — Cold Storage", remarks: "Cold chain broke in transit; returned to supplier; replacement scheduled.",
    status: "rejected_damaged", createdAt: day(-5),
  },
];

const SEED_RECEIPTS: SupplyReceipt[] = [
  {
    id: "RR-2026-0081", arrivalId: "SC-DLV-2026-0311",
    supplierId: "SUP-2026-10001", supplierName: "BeautyPH Cosmetics Inc.",
    items: [
      { productName: "Korean BB Cream SPF 50+", qty: 200, unit: "pcs", condition: "good" },
      { productName: "Hyaluronic Acid Serum 30ml", qty: 120, unit: "pcs", condition: "good" },
    ],
    totalQty: 320, receivedAt: day(-1, 14), receivingBy: "R. Dela Cruz",
    docRef: "DR-2026-5881", remarks: "Completed receiving; forwarded to inventory.",
  },
  {
    id: "RR-2026-0078", arrivalId: "SC-DLV-2026-0298",
    supplierId: "SUP-2026-10032", supplierName: "Pacific Dry Goods Trading",
    items: [{ productName: "Canned Sardines 155g", qty: 1500, unit: "pcs", condition: "good" }],
    totalQty: 1500, receivedAt: day(-3, 14), receivingBy: "R. Dela Cruz",
    docRef: "DR-2026-5871", remarks: "Received 1500 of 2000 pcs; balance pending.",
  },
  {
    id: "RR-2026-0075", arrivalId: "SC-DLV-2026-0287",
    supplierId: "SUP-2026-10001", supplierName: "BeautyPH Cosmetics Inc.",
    items: [{ productName: "Matte Lipstick Trio", qty: 120, unit: "pcs", condition: "good" }],
    totalQty: 120, receivedAt: day(-2, 11), receivingBy: "K. Banag",
    docRef: "DR-2026-5866", remarks: "Count and condition verified, pending final confirmation.",
  },
  {
    id: "RR-2026-0072", arrivalId: "SC-DLV-2026-0272",
    supplierId: "SUP-2026-10045", supplierName: "Pacific Fresh Distributors Inc.",
    items: [{ productName: "Frozen Shrimp Vannamei (HLSO)", qty: 150, unit: "kg", condition: "rejected" }],
    totalQty: 150, receivedAt: day(-4, 14), receivingBy: "J. Mercado",
    docRef: "DR-2026-5859", remarks: "Rejected — cold chain broken in transit, product temperature above acceptable range.",
  },
];

const SEED_NOTIFS: AppNotification[] = [
  { id: "N-001", title: "Supply Available for Receiving", message: "SC-DLV-2026-0334 (Pacific Dry Goods) arrived and is ready for receiving at Warehouse A.", type: "info", read: false, timestamp: day(0, 9) },
  { id: "N-002", title: "Expected Supply Incoming", message: "SC-DLV-2026-0338 (Pacific Fresh Distributors) expected delivery tomorrow at Cold Storage.", type: "info", read: true, timestamp: day(-1, 16) },
  { id: "N-003", title: "Receiving Recorded", message: "Received 1,500 pcs canned sardines; 500 pcs still pending from Pacific Dry (SC-DLV-2026-0298).", type: "warning", read: true, timestamp: day(-3, 15) },
  { id: "N-004", title: "Damaged Supply Rejected", message: "Frozen shrimp delivery rejected — cold chain broke in transit (SC-DLV-2026-0272).", type: "error", read: true, timestamp: day(-4, 15) },
  { id: "N-005", title: "Receiving Completed", message: "Korean BB Cream & HA Serum receiving completed and forwarded to inventory (RR-2026-0081).", type: "success", read: true, timestamp: day(-1, 14) },
];

/* ── persistence ───────────────────────────────────────── */

const LS_KEYS = {
  suppliers: "trim_vendor_suppliers_v4",
  arrivals: "trim_vendor_arrivals_v4",
  receipts: "trim_vendor_receipts_v4",
  notifs: "trim_vendor_notifications_v4",
  adminSession: "trim_vendor_admin_session",
};

export function usePersisted<T>(key: string, seed: T): [T, Dispatch<SetStateAction<T>>] {
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

export function useAdminSession(): [boolean, (v: boolean) => void] {
  const [isAdmin, setRaw] = usePersisted<boolean>(LS_KEYS.adminSession, false);
  return [isAdmin, setRaw];
}

/* ── store + business actions ──────────────────────────── */

export interface VendorData {
  suppliers: Supplier[];      /* provided by the Supply Chain subsystem */
  arrivals: SupplyArrival[];  /* expected / pending supply schedules */
  receipts: SupplyReceipt[];  /* receiving history (recorded transactions) */
  notifications: AppNotification[];
}

export interface VendorActions {
  recordReceipt: (rec: SupplyReceipt) => void;
  updateArrivalStatus: (id: string, status: SupplyStatus) => void;
  toggleSupplierActive: (id: string) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  clearNotifications: () => void;
}

export function useVendorData(): { data: VendorData; actions: VendorActions } {
  const [suppliers, setSuppliers] = usePersisted<Supplier[]>(LS_KEYS.suppliers, SEED_SUPPLIERS);
  const [arrivals, setArrivals] = usePersisted<SupplyArrival[]>(LS_KEYS.arrivals, SEED_ARRIVALS);
  const [receipts, setReceipts] = usePersisted<SupplyReceipt[]>(LS_KEYS.receipts, SEED_RECEIPTS);
  const [notifications, setNotifications] = usePersisted<AppNotification[]>(LS_KEYS.notifs, SEED_NOTIFS);

  const pushNotif = (n: Omit<AppNotification, "id" | "read" | "timestamp">) =>
    setNotifications(prev => [{ ...n, id: `N-${Date.now()}`, read: false, timestamp: now() }, ...prev]);

  const recordReceipt: VendorActions["recordReceipt"] = (rec) => {
    const isEdit = receipts.some(r => r.id === rec.id);
    setReceipts(prev => {
      const exists = prev.some(r => r.id === rec.id);
      const next = exists ? prev.map(r => r.id === rec.id ? rec : r) : [rec, ...prev];

      /* Re-sync the linked expected supply based on recorded quantities. */
      if (rec.arrivalId) {
        const received = next.filter(r => r.arrivalId === rec.arrivalId).reduce((a, r) => a + r.totalQty, 0);
        const hasIssue = next.some(r => r.arrivalId === rec.arrivalId && r.items.some(i => i.condition !== "good"));
        setArrivals(arrPrev => arrPrev.map(a => {
          if (a.id !== rec.arrivalId) return a;
          let status: SupplyStatus;
          if (hasIssue) status = "rejected_damaged";
          else if (received >= a.totalQty) status = "received";
          else status = "partially_received";
          return { ...a, status };
        }));
      }
      return next;
    });
    pushNotif({
      title: isEdit ? "Receiving Record Updated" : "Receiving Recorded",
      message: `${rec.supplierName} — ${rec.totalQty} units received${rec.arrivalId ? ` against ${rec.arrivalId}` : ""} (${rec.id}).`,
      type: rec.items.some(i => i.condition !== "good") ? "error" : "success",
    });
  };

  const updateArrivalStatus: VendorActions["updateArrivalStatus"] = (id, status) => {
    setArrivals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    const arrival = arrivals.find(a => a.id === id);
    if (arrival) {
      const statusLabel = SUPPLY_STATUS_CFG[status].label;
      pushNotif({
        title: `Supply status updated`,
        message: `${arrival.supplierName} (${id}) moved to “${statusLabel}”.`,
        type: status === "rejected_damaged" ? "error" : status === "completed" ? "success" : "info",
      });
    }
  };

  const toggleSupplierActive: VendorActions["toggleSupplierActive"] = (id) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, status: s.status === "active" ? "inactive" : "active" } : s));
  };

  return {
    data: { suppliers, arrivals, receipts, notifications },
    actions: {
      recordReceipt,
      updateArrivalStatus,
      toggleSupplierActive,
      markNotifRead: (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)),
      markAllNotifsRead: () => setNotifications(prev => prev.map(n => ({ ...n, read: true }))),
      clearNotifications: () => setNotifications([]),
    },
  };
}