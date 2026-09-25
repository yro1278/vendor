export const SUPPLY_STATUSES = [
  "expected",
  "for_receiving",
  "received",
  "partially_received",
  "completed",
  "rejected_damaged",
];

export const CONDITIONS = ["good", "damaged", "rejected"];

export const RECEIPT_STATUSES = ["draft", "ready", "confirmed", "completed", "rejected"];

export const COUNT_UNITS = ["pcs", "box", "case", "sack", "bag", "pack", "pallet"];

export const RECEIPT_STATUS_LABEL = {
  draft: "Draft",
  ready: "Ready for Confirmation",
  confirmed: "Confirmed",
  completed: "Completed",
  rejected: "Rejected",
};
export const SUPPLIER_TYPES = ["Manufacturer", "Distributor", "Wholesaler", "Importer", "Other"];
export const SUPPLIER_STATUSES = ["active", "inactive"];
export const NOTIF_TYPES = ["info", "success", "warning", "error"];
export const UNIT_OPTIONS = ["pcs", "box", "case", "sack", "bag", "kg", "L", "pack", "pallet"];

export const REQUEST_PRIORITIES = ["low", "normal", "high", "urgent"];

/* Single default vendor/company account that owns the seeded catalog and
   receiving data. Vendor isolation scopes every vendor API response to this. */
export const DEFAULT_VENDOR_ID = "VND-2026-0001";
export const DEFAULT_VENDOR_NAME = "Tri-M Global Logistics & Trading Inc.";
export const DEFAULT_VENDOR = {
  id: DEFAULT_VENDOR_ID,
  companyName: DEFAULT_VENDOR_NAME,
  contactName: "Warehouse Supervisor",
  contactEmail: "info.tmglt@gmail.com",
  contactPhone: "+63 2 5555 0100",
  address: "Blk. 1A Lot 14, Verde Heights Subd., Brgy. Gaya-Gaya, City of San Jose del Monte, Bulacan",
};

/* Vendor Management roles. "admin" manages suppliers, evaluation,
   performance, applications, reporting and overall administration.
   "receiving_staff" is the dock/operations user who records incoming
   supplies, verifies quantities/condition, and confirms receipt. */
export const SYSTEM_ROLES = ["admin", "receiving_staff"];
export const ALLOWED_VENDOR_ROLES = SYSTEM_ROLES;

export const ROLE_LABEL = {
  admin: "Admin",
  receiving_staff: "Receiving Staff",
};

export const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "processing",
  "fulfillment_in_progress",
  "partially_fulfilled",
  "fulfilled",
  "rejected",
  "cancelled",
];

/* Statuses that belong to the Supply Chain workflow. The Vendor
   cannot move a request into these states directly. */
export const SC_OWNED_REQUEST_STATUSES = [
  "under_review",
  "approved",
  "processing",
  "fulfillment_in_progress",
  "partially_fulfilled",
  "fulfilled",
  "rejected",
];

export const REQUEST_STATUS_LABEL = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  processing: "Processing",
  fulfillment_in_progress: "Fulfillment In Progress",
  partially_fulfilled: "Partially Fulfilled",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const SUPPLY_STATUS_LABEL = {
  expected: "Expected",
  for_receiving: "For Receiving",
  received: "Received",
  partially_received: "Partially Received",
  completed: "Completed",
  rejected_damaged: "Rejected / Damaged",
};

/* Public supplier-sourcing workflow statuses. Applications start at
   pending_review; approval materializes a suppliers row. */
export const APPLICATION_STATUSES = [
  "pending_review",
  "under_review",
  "revision_required",
  "approved",
  "rejected",
];

export const APPLICATION_STATUS_LABEL = {
  pending_review: "Pending Review",
  under_review: "Under Review",
  revision_required: "Revision Required",
  approved: "Approved",
  rejected: "Rejected",
};

/* Fixed evaluation criteria weights (sum to 100). Per-criterion scores are
   0–100 in evaluation_criteria; the weighted total is persisted to suppliers. */
export const EVALUATION_CRITERIA = [
  { key: "quality", label: "Product Quality", weight: 30 },
  { key: "delivery", label: "Delivery Reliability", weight: 25 },
  { key: "pricing", label: "Pricing Competitiveness", weight: 20 },
  { key: "communication", label: "Communication", weight: 15 },
  { key: "compliance", label: "Compliance & Documentation", weight: 10 },
];

export const APPLICATION_DOC_MIME = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};