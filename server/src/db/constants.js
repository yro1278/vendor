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

export const ALLOWED_VENDOR_ROLES = ["admin", "vendor"];

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