import type {
  AppNotification,
  SupplyArrival,
  SupplyReceipt,
  SupplyRequest,
  SupplyRequestInput,
  Supplier,
  SupplyStatus,
} from "./vendor-data";

const TOKEN_KEY = "trim_vendor_admin_token";
const SESSION_KEY = "trim_vendor_admin_session";

const env = import.meta as unknown as { env?: Record<string, string | undefined> };
const API_BASE = (env.env?.VITE_API_URL ?? "").replace(/\/$/, "");

export interface BootstrapData {
  suppliers: Supplier[];
  arrivals: SupplyArrival[];
  receipts: SupplyReceipt[];
  notifications: AppNotification[];
  supplyRequests: SupplyRequest[];
  products: Product[];
}

export interface LoginResult {
  token: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    role: string;
    vendorId: string;
  };
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function setSessionUser(user: LoginResult["user"] | null): void {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getSessionUser(): LoginResult["user"] | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LoginResult["user"];
  } catch {
    return null;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init.body) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the vendor server. Check that the backend is running.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    const bodyObj = body as { error?: string; errors?: Record<string, string> } | null;
    const message = bodyObj?.error ?? `Request failed (${res.status})`;
    if (res.status === 401) {
      clearToken();
      unauthorizedHandler?.();
    }
    throw new ApiError(res.status, message, bodyObj?.errors);
  }
  return body as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ user: LoginResult["user"] }>("/auth/me"),

  logout: () =>
    request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
    }),

  bootstrap: () => request<BootstrapData>("/vendor/bootstrap"),

  createReceipt: (rec: SupplyReceipt) =>
    request<SupplyReceipt>("/vendor/receiving", {
      method: "POST",
      body: JSON.stringify(rec),
    }),

  updateReceipt: (rec: SupplyReceipt) =>
    request<SupplyReceipt>(`/vendor/receiving/${encodeURIComponent(rec.id)}`, {
      method: "PUT",
      body: JSON.stringify(rec),
    }),

  updateArrivalStatus: (id: string, status: SupplyStatus) =>
    request<{ ok: boolean }>(`/vendor/arrivals/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  setSupplierStatus: (id: string, status: "active" | "inactive") =>
    request<{ ok: boolean }>(`/vendor/suppliers/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  markNotifRead: (id: string) =>
    request<{ ok: boolean }>(`/vendor/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    }),

  markAllNotifsRead: () =>
    request<{ ok: boolean }>("/vendor/notifications/read-all", { method: "POST" }),

  clearNotifications: () =>
    request<{ ok: boolean }>("/vendor/notifications/clear", { method: "DELETE" }),

  getSupplyRequest: (id: string) =>
    request<SupplyRequest>(`/vendor/supply-requests/${encodeURIComponent(id)}`),

  createSupplyRequest: (payload: SupplyRequestInput) =>
    request<SupplyRequest>("/vendor/supply-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSupplyRequest: (id: string, payload: SupplyRequestInput) =>
    request<SupplyRequest>(`/vendor/supply-requests/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  submitSupplyRequest: (id: string) =>
    request<SupplyRequest>(`/vendor/supply-requests/${encodeURIComponent(id)}/submit`, {
      method: "POST",
    }),

  cancelSupplyRequest: (id: string) =>
    request<SupplyRequest>(`/vendor/supply-requests/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    }),

  receivingHistory: (params: { from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    const qs = q.toString();
    return request<SupplyReceipt[]>(`/vendor/receiving/history${qs ? `?${qs}` : ""}`);
  },

  verifyReceivingReportPassword: (password: string) =>
    request<{ ok: boolean; grant: string }>("/vendor/receiving/report/verify", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  generateReceivingReport: (grant: string, params: { from?: string; to?: string } = {}) => {
    const body: { grant: string; from?: string; to?: string } = { grant };
    if (params.from) body.from = params.from;
    if (params.to) body.to = params.to;
    return request<{ ok: boolean; filename: string; pdfBase64: string }>("/vendor/receiving/report", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /* Slide the server-side 30-minute inactivity window (Stay Logged In / active
     heartbeat). The backend enforces the same window on every /api/vendor call. */
  touchSession: () => request<{ ok: boolean; expiresAt?: string }>("/vendor/session/touch", { method: "POST" }),
};