import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, clearToken, CompanyProfile } from "./api";

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

   All business data (suppliers, expected supplies, receiving
   history, notifications) is loaded from the Express + MySQL
   backend. No business data is hardcoded in the frontend.
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
  qty: number;                    /* quantity for THIS condition row */
  totalQty?: number;              /* total received quantity for the product/unit (GOOD + DAMAGED) */
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

/* ── supply requests ──────────────────────────────────────
   The vendor only requests WHAT / HOW MUCH / WHEN / WHY it needs.
   Supplier sourcing, selection and procurement belong to the
   Supply Chain subsystem — never captured here. */

export type RequestPriority = "low" | "normal" | "high" | "urgent";

export type SupplyRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "processing"
  | "fulfillment_in_progress"
  | "partially_fulfilled"
  | "fulfilled"
  | "rejected"
  | "cancelled";

/* What the vendor submits when creating/editing a request. Request ref,
   requested-by and request date are produced by the backend. */
export interface SupplyRequestInput {
  neededByDate: string;
  priority: RequestPriority;
  reason: string;
  remarks: string;
  items: { productId: number; qty: number; unit: string; remarks: string }[];
}

export interface SupplyRequestItem {
  id: number;
  productId: number | null;
  productName: string;
  qty: number;
  unit: string;
  remarks: string;
}

export interface SupplyRequestFulfillmentLine {
  productId: number | null;
  productName: string;
  unit: string;
  requestedQty: number;
  fulfilledQty: number;
  remainingQty: number;
}

export interface SupplyRequestFulfillment {
  items: SupplyRequestFulfillmentLine[];
  progress: "new" | "partial" | "fulfilled";
}

export interface SupplyRequest {
  id: string;                       /* VR-YYYY-NNNN — generated by the backend */
  requestedBy: number;
  requestDate: string;
  neededByDate: string;
  priority: RequestPriority;
  reason: string;
  remarks: string;
  status: SupplyRequestStatus;
  submittedAt: string;
  scReference: string;              /* Supply Chain processing reference (when assigned) */
  processingStatus: string;
  supplierId: string;               /* Supplier assigned by Supply Chain (vendor never selects) */
  supplierName: string;
  expectedDeliveryDate: string;
  items: SupplyRequestItem[];
  fulfillment: SupplyRequestFulfillment;  /* derived from real receiving records */
  createdAt: string;
  updatedAt: string;
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

export const REQUEST_PRIORITIES: RequestPriority[] = ["low", "normal", "high", "urgent"];

export const REQUEST_PRIORITY_LABEL: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const REQUEST_STATUS_CFG: Record<SupplyRequestStatus, { label: string; cls: string; dot: string }> = {
  draft:                   { label: "Draft",                    cls: "bg-slate-50 text-slate-600 border-slate-200",       dot: "bg-slate-400" },
  submitted:               { label: "Submitted",                cls: "bg-sky-50 text-sky-700 border-sky-200",             dot: "bg-sky-500" },
  under_review:            { label: "Under Review",             cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  approved:                { label: "Approved",                 cls: "bg-violet-50 text-violet-700 border-violet-200",     dot: "bg-violet-500" },
  processing:              { label: "Processing",               cls: "bg-indigo-50 text-indigo-700 border-indigo-200",     dot: "bg-indigo-500" },
  fulfillment_in_progress: { label: "Fulfillment In Progress",  cls: "bg-cyan-50 text-cyan-700 border-cyan-200",           dot: "bg-cyan-500" },
  partially_fulfilled:     { label: "Partially Fulfilled",      cls: "bg-orange-50 text-orange-700 border-orange-200",     dot: "bg-orange-500" },
  fulfilled:               { label: "Fulfilled",                cls: "bg-green-50 text-green-700 border-green-200",        dot: "bg-green-500" },
  rejected:                { label: "Rejected",                 cls: "bg-red-50 text-red-700 border-red-200",              dot: "bg-red-500" },
  cancelled:               { label: "Cancelled",                cls: "bg-slate-50 text-slate-500 border-slate-200",        dot: "bg-slate-400" },
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

/* ── persistence (auth flag only — business data lives in MySQL) ── */

const LS_KEYS = {
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
  supplyRequests: SupplyRequest[];
  products: Product[];        /* product master (existing supplier_products records) */
  profile: CompanyProfile | null;  /* company profile from the vendors table */
}

export interface VendorActions {
  recordReceipt: (rec: SupplyReceipt) => Promise<{ ok: boolean; error?: string; errors?: Record<string, string> }>;
  updateArrivalStatus: (id: string, status: SupplyStatus) => void;
  toggleSupplierActive: (id: string) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  clearNotifications: () => void;
  createSupplyRequest: (input: SupplyRequestInput) => Promise<{ ok: boolean; id?: string; error?: string; errors?: Record<string, string> }>;
  updateSupplyRequest: (id: string, input: SupplyRequestInput) => Promise<{ ok: boolean; id?: string; error?: string; errors?: Record<string, string> }>;
  submitSupplyRequest: (id: string) => Promise<{ ok: boolean; error?: string }>;
  cancelSupplyRequest: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

/* For each distinct product+unit, the declared total received
   quantity is the sum of its condition rows (GOOD + DAMAGED). */
function withItemTotals(rec: SupplyReceipt): SupplyReceipt {
  const totals = new Map<string, number>();
  for (const i of rec.items) {
    const key = `${i.productName}::${i.unit}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(i.qty));
  }
  return {
    ...rec,
    items: rec.items.map(i => ({
      ...i,
      qty: Number(i.qty),
      totalQty: totals.get(`${i.productName}::${i.unit}`),
    })),
  };
}

export function useVendorData(): {
  data: VendorData;
  actions: VendorActions;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  refresh: () => Promise<void>;
} {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [arrivals, setArrivals] = useState<SupplyArrival[]>([]);
  const [receipts, setReceipts] = useState<SupplyReceipt[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const settersRef = useRef({ setSuppliers, setArrivals, setReceipts, setNotifications, setSupplyRequests, setProducts, setProfile });
  settersRef.current = { setSuppliers, setArrivals, setReceipts, setNotifications, setSupplyRequests, setProducts, setProfile };

  const refresh = useCallback(async () => {
    setSessionExpired(false);
    try {
      const boot = await api.bootstrap();
      const s = settersRef.current;
      s.setSuppliers(boot.suppliers);
      s.setArrivals(boot.arrivals);
      s.setReceipts(boot.receipts);
      s.setNotifications(boot.notifications);
      s.setSupplyRequests(boot.supplyRequests);
      s.setProducts(boot.products);
      const profile = await api.getCompanyProfile();
      s.setProfile(profile);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setSessionExpired(true);
      }
      const offline = e instanceof ApiError && e.status === 0;
      setError(
        offline
          ? "Cannot reach the vendor server. Check that the MySQL backend is running."
          : e instanceof ApiError
            ? `Failed to load vendor data: ${e.message}`
            : "Failed to load vendor data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sync = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
      return true;
    } catch {
      setError("Cannot reach the vendor server. Changes may not have been saved.");
      return false;
    }
  }, [refresh]);

  const recordReceipt: VendorActions["recordReceipt"] = async (rec) => {
    const isEdit = receipts.some(r => r.id === rec.id);
    const payload = withItemTotals(rec);
    try {
      if (isEdit) await api.updateReceipt(payload);
      else await api.createReceipt(payload);
      await refresh();
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError) return { ok: false, error: e.message, errors: e.errors };
      return { ok: false, error: "Failed to save the receiving record." };
    }
  };

  const updateArrivalStatus: VendorActions["updateArrivalStatus"] = (id, status) => {
    setArrivals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    void sync(() => api.updateArrivalStatus(id, status));
  };

  const toggleSupplierActive: VendorActions["toggleSupplierActive"] = (id) => {
    const nextStatus: "active" | "inactive" =
      suppliers.find(s => s.id === id)?.status === "active" ? "inactive" : "active";
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    void sync(() => api.setSupplierStatus(id, nextStatus));
  };

  const requestResult = (e: unknown, fallback: string): { ok: false; error: string; errors?: Record<string, string> } =>
    e instanceof ApiError ? { ok: false, error: e.message, errors: e.errors } : { ok: false, error: fallback };

  const createSupplyRequest: VendorActions["createSupplyRequest"] = async (input) => {
    try {
      const created = await api.createSupplyRequest(input);
      await refresh();
      return { ok: true, id: created.id };
    } catch (e) {
      return requestResult(e, "Failed to create the supply request.");
    }
  };

  const updateSupplyRequest: VendorActions["updateSupplyRequest"] = async (id, input) => {
    try {
      const updated = await api.updateSupplyRequest(id, input);
      await refresh();
      return { ok: true, id: updated.id };
    } catch (e) {
      return requestResult(e, "Failed to update the supply request.");
    }
  };

  const submitSupplyRequest: VendorActions["submitSupplyRequest"] = async (id) => {
    try {
      await api.submitSupplyRequest(id);
      await refresh();
      return { ok: true };
    } catch (e) {
      return requestResult(e, "Failed to submit the supply request.");
    }
  };

  const cancelSupplyRequest: VendorActions["cancelSupplyRequest"] = async (id) => {
    try {
      await api.cancelSupplyRequest(id);
      await refresh();
      return { ok: true };
    } catch (e) {
      return requestResult(e, "Failed to cancel the supply request.");
    }
  };

  return {
    data: { suppliers, arrivals, receipts, notifications, supplyRequests, products, profile },
    loading,
    error,
    sessionExpired,
    refresh,
    actions: {
      recordReceipt,
      updateArrivalStatus,
      toggleSupplierActive,
      createSupplyRequest,
      updateSupplyRequest,
      submitSupplyRequest,
      cancelSupplyRequest,
      markNotifRead: (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        void sync(() => api.markNotifRead(id));
      },
      markAllNotifsRead: () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        void sync(() => api.markAllNotifsRead());
      },
      clearNotifications: () => {
        setNotifications([]);
        void sync(() => api.clearNotifications());
      },
    },
  };
}