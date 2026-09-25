import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, clearToken } from "./api";

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
  | "pending"
  | "partially_received"
  | "completed";

export type ReceiptCondition = "good" | "damaged" | "rejected";

/* Status of a replacement request — a SEPARATE workflow from receiving.
   Requested is opened by the Vendor; APPROVED → FOR DELIVERY → DELIVERED are
   moved by the Supply Chain subsystem; RECEIVED / COMPLETED reflect units the
   Vendor physically received against the request; CANCELLED means voided. */
export type ReplacementStatus =
  | "requested"
  | "approved"
  | "for_delivery"
  | "delivered"
  | "received"
  | "completed"
  | "cancelled";

/* Replacement request for a product whose original receipt fell short of the
   expected quantity (damaged / rejected / short shipment). The quantity is
   always derived by the system: Replacement Required = Expected − Accepted. */
export interface ReplacementRequest {
  id: string;
  arrivalId: string;
  arrivalRef: string;             /* SC-SCHED-… source reference for the delivery */
  supplierId: string;
  supplierName: string;
  productName: string;
  unit: string;
  expectedQty: number;
  acceptedQty: number;            /* GOOD units accepted on the original receipt */
  damagedQty: number;             /* damaged + rejected units on the original receipt */
  replacementQty: number;         /* derived: max(0, expected − accepted) */
  receivedQty: number;            /* good units received against this request */
  remainingQty: number;           /* replacementQty − receivedQty */
  reason: string;
  remarks: string;
  status: ReplacementStatus;
  requestedBy: string;
  requestedAt: string;
  createdAt: string;
}

/* A Vendor Receiving acknowledgment. Records receipt of ACCEPTED stock (the
   Checker/Inspection result). Partial acknowledgments stack until every
   accepted unit is covered → the delivery becomes COMPLETED. */
export interface VendorReceivingItem {
  productName: string;
  unit: string;
  qty: number;
}

export interface VendorReceiving {
  id: string;
  arrivalId: string;
  arrivalRef: string;
  supplierId: string;
  supplierName: string;
  receivedBy: string;
  receivedAt: string;
  remarks: string;
  items: VendorReceivingItem[];
}

/* A discrepancy report filed against an inspection/delivery. The Vendor can
   never modify the Checker's quantities — disputes ride this traceable channel. */
export interface DiscrepancyReport {
  id: string;
  arrivalId: string;
  arrivalRef: string;
  supplierName: string;
  receiptId: string | null;
  discrepancyType: string;
  description: string;
  requestedCorrection: string;
  status: string;
  reportedBy: string;
  reportedAt: string;
}

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
  /* Receiving math derived server-side per delivery product:
     accepted = GOOD units across all receipts; only good enters stock.
     replacementRequired = Expected − Accepted(good on original receipts);
     replacementReceived = good units received against replacement requests. */
  acceptedQty?: number;
  damagedQty?: number;
  /* Vendor accepting math derived server-side per delivery product:
     vendorReceived = units already acknowledged by the Vendor;
     availableQty = acceptedQty − vendorReceived (for partial receiving);
     requiredQty = original expected quantity of this product;
     remainingQty = requiredQty − vendorReceived (units still owed vs original). */
  vendorReceived?: number;
  availableQty?: number;
  requiredQty?: number;
  remainingQty?: number;
  replacementRequired?: number;
  replacementReceived?: number;
  replacementRemaining?: number;
  fulfilled?: boolean;
}

/* A document that travels with a Supply Chain delivery. The receiving form
   reads these from the linked arrival — the vendor never re-types references
   or re-uploads SC documents. */
export interface SupplyDeliveryDocument {
  id: number;
  name: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
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
  docs: SupplyDeliveryDocument[]; /* documents supplied by the SC delivery */
  createdAt: string;
  /* Fulfillment math derived server-side per delivery (authoritative):
     requiredQty = original expected total (sum of item.qty);
     acceptedQty = GOOD checker-received total;
     receivedQty = cumulative Vendor acknowledgment total;
     remainingQty = requiredQty − receivedQty (still owed vs original). */
  requiredQty?: number;
  acceptedQty?: number;
  receivedQty?: number;
  remainingQty?: number;
}

export interface ReceiptItem {
  productName: string;
  qty: number;                    /* quantity for THIS condition row */
  totalQty?: number;              /* total received quantity for the product/unit (GOOD + DAMAGED) */
  unit: string;
  condition: ReceiptCondition;
  returnToSc?: boolean;           /* damaged/rejected units marked "return to Supply Chain" */
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
  kind: "original" | "replacement";
  replacementRequestId: string | null;
  conditionSummary?: { good: number; damaged: number; rejected: number };
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
  pending:            { label: "Pending",            cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  partially_received: { label: "Partially Received", cls: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  completed:          { label: "Completed",          cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
};

/* A server may still be serving legacy status values (for_receiving, received,
   rejected_damaged) while this UI builds the new status model. Every lookup
   must go through supplyStatusCfg() so an unknown value renders a neutral
   badge instead of crashing the whole view. */
const UNKNOWN_STATUS_CFG = { label: "Processing", cls: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-400" };

export const supplyStatusCfg = (status: string): { label: string; cls: string; dot: string } =>
  SUPPLY_STATUS_CFG[status as SupplyStatus] ?? UNKNOWN_STATUS_CFG;

export const REPLACEMENT_STATUS_CFG: Record<ReplacementStatus, { label: string; cls: string; dot: string }> = {
  requested:   { label: "Requested",   cls: "bg-sky-50 text-sky-700 border-sky-200",       dot: "bg-sky-500" },
  approved:    { label: "Approved",    cls: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  for_delivery: { label: "For Delivery", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  delivered:   { label: "Delivered",   cls: "bg-cyan-50 text-cyan-700 border-cyan-200",     dot: "bg-cyan-500" },
  received:    { label: "Received",    cls: "bg-amber-50 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  completed:   { label: "Completed",   cls: "bg-green-50 text-green-700 border-green-200",   dot: "bg-green-500" },
  cancelled:   { label: "Cancelled",   cls: "bg-slate-50 text-slate-500 border-slate-200",   dot: "bg-slate-400" },
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

/* GOOD units accepted so far for a delivery (stock-relevant, across receipts). */
export const arrivalAcceptedGood = (arrivalId: string, receipts: SupplyReceipt[]) =>
  receipts
    .filter(r => r.arrivalId === arrivalId)
    .reduce((a, r) => a + r.items.filter(i => i.condition === "good").reduce((b, i) => b + i.qty, 0), 0);

export const arrivalHasIssue = (arrivalId: string, receipts: SupplyReceipt[]) =>
  receipts.some(r => r.arrivalId === arrivalId && r.items.some(i => i.condition !== "good"));

export const receiptHasIssue = (rec: SupplyReceipt) => rec.items.some(i => i.condition !== "good");

/* ACCEPTED stock the Vendor has acknowledged receiving so far for a delivery
   (sum of vendor_receiving_items rows). */
export const arrivalVendorReceivedQty = (arrivalId: string, vendorReceivings: VendorReceiving[]) =>
  vendorReceivings
    .filter(v => v.arrivalId === arrivalId)
    .reduce((a, v) => a + v.items.reduce((b, i) => b + i.qty, 0), 0);

export const supplierReceivedQty = (supplierId: string, receipts: SupplyReceipt[]) =>
  receipts.filter(r => r.supplierId === supplierId).reduce((a, r) => a + r.totalQty, 0);

/* ── roles ──────────────────────────────────────────────── */

/* Canonical role values must match the backend (server/src/db/constants.js). */
export type SystemRole = "admin" | "receiving_staff";

export const SYSTEM_ROLES: readonly SystemRole[] = ["admin", "receiving_staff"];

export const ROLE_LABELS: Record<SystemRole, string> = {
  admin: "Admin",
  receiving_staff: "Receiving Staff",
};

export const isSystemRole = (r: string | null | undefined): r is SystemRole =>
  !!r && (SYSTEM_ROLES as readonly string[]).includes(r);

/* ── persistence (auth session only — business data lives in MySQL) ── */

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

export function useSessionRole(): [string | null, (v: string | null) => void] {
  const [role, setRole] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem("trim_vendor_role");
      if (raw && isSystemRole(raw)) return raw;
    } catch { /* ignore corrupt data */ }
    return null;
  });
  const set = (v: string | null) => {
    setRole(v);
    try {
      if (v && isSystemRole(v)) localStorage.setItem("trim_vendor_role", v);
      else localStorage.removeItem("trim_vendor_role");
    } catch { /* ignore quota */ }
  };
  return [role, set];
}

/* ── store + business actions ──────────────────────────── */

export interface VendorData {
  suppliers: Supplier[];      /* provided by the Supply Chain subsystem */
  arrivals: SupplyArrival[];  /* expected / pending supply schedules */
  receipts: SupplyReceipt[];  /* receiving history (recorded transactions) */
  notifications: AppNotification[];
  supplyRequests: SupplyRequest[];
  products: Product[];        /* product master (existing supplier_products records) */
  replacementRequests: ReplacementRequest[];
  vendorReceivings: VendorReceiving[];
  discrepancyReports: DiscrepancyReport[];
}

export interface VendorActions {
  /* The Vendor is the FINAL RECEIVER only. It never records inspections,
     reopens deliveries, opens replacement requests, or reports discrepancies —
     those belong to the Receiving/Checker subsystem. The only receiving action
     on the Vendor side is acknowledging the already-accepted stock. */
  confirmVendorReceiving: (arrivalId: string, input: { id: string; items: { productName: string; unit: string; qty: number }[]; receivedAt: string; receivingBy: string; remarks: string }) => Promise<{ ok: boolean; error?: string }>;
  toggleSupplierActive: (id: string) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  clearNotifications: () => void;
  createSupplyRequest: (input: SupplyRequestInput) => Promise<{ ok: boolean; id?: string; error?: string; errors?: Record<string, string> }>;
  updateSupplyRequest: (id: string, input: SupplyRequestInput) => Promise<{ ok: boolean; id?: string; error?: string; errors?: Record<string, string> }>;
  submitSupplyRequest: (id: string) => Promise<{ ok: boolean; error?: string }>;
  cancelSupplyRequest: (id: string) => Promise<{ ok: boolean; error?: string }>;
  searchReceivingHistory: (from?: string, to?: string) => Promise<{ ok: true; rows: SupplyReceipt[] } | { ok: false; error: string }>;
  listArrivalDocuments: (arrivalId: string) => Promise<SupplyDeliveryDocument[]>;
  fetchArrivalFile: (arrivalId: string, docId: number) => Promise<Blob>;
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
  const [replacementRequests, setReplacementRequests] = useState<ReplacementRequest[]>([]);
  const [vendorReceivings, setVendorReceivings] = useState<VendorReceiving[]>([]);
  const [discrepancyReports, setDiscrepancyReports] = useState<DiscrepancyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const settersRef = useRef({ setSuppliers, setArrivals, setReceipts, setNotifications, setSupplyRequests, setProducts, setReplacementRequests, setVendorReceivings, setDiscrepancyReports });
  settersRef.current = { setSuppliers, setArrivals, setReceipts, setNotifications, setSupplyRequests, setProducts, setReplacementRequests, setVendorReceivings, setDiscrepancyReports };

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
      s.setReplacementRequests(boot.replacementRequests ?? []);
      s.setVendorReceivings(boot.vendorReceivings ?? []);
      s.setDiscrepancyReports(boot.discrepancyReports ?? []);
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

  const confirmVendorReceiving: VendorActions["confirmVendorReceiving"] = async (arrivalId, input) => {
    try {
      await api.confirmVendorReceiving(arrivalId, input);
      await refresh();
      return { ok: true };
    } catch (e) {
      return requestResult(e, "Failed to confirm Vendor receiving.");
    }
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

  const searchReceivingHistory: VendorActions["searchReceivingHistory"] = async (from, to) => {
    try {
      return { ok: true, rows: await api.receivingHistory({ from, to }) };
    } catch (e) {
      return { ok: false, error: requestResult(e, "Failed to filter receiving history.").error };
    }
  };

  const listArrivalDocuments: VendorActions["listArrivalDocuments"] = (arrivalId) =>
    api.listArrivalDocuments(arrivalId);

  const fetchArrivalFile: VendorActions["fetchArrivalFile"] = (arrivalId, docId) =>
    api.fetchArrivalFile(arrivalId, docId);

  return {
    data: { suppliers, arrivals, receipts, notifications, supplyRequests, products, replacementRequests, vendorReceivings, discrepancyReports },
    loading,
    error,
    sessionExpired,
    refresh,
    actions: {
      confirmVendorReceiving,
      toggleSupplierActive,
      createSupplyRequest,
      updateSupplyRequest,
      submitSupplyRequest,
      cancelSupplyRequest,
      searchReceivingHistory,
      listArrivalDocuments,
      fetchArrivalFile,
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