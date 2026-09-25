export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const httpError = (status, message, extra) => new HttpError(status, message, extra);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export const genId = (prefix) =>
  `${prefix}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

export const genNotifId = () => `N-${Date.now()}${Math.floor(Math.random() * 90 + 10)}`;

export const toIso = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(+value) ? null : value.toISOString();
  const s = String(value);
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(+d) ? s : d.toISOString();
};

export const toDbDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(+d)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

const round3 = (n) => Math.round(n * 1000) / 1000;

export function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    brand: row.brand,
    category: row.category,
  };
}

export function mapSupplier(row, products = []) {
  return {
    id: row.id,
    sourceRef: row.source_ref,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    supplierType: row.supplier_type,
    products: products.map(mapProduct),
    address: row.address,
    email: row.email,
    phone: row.phone,
    website: row.website,
    distributionArea: row.distribution_area,
    status: row.status,
    establishedOn: row.established_on ?? "",
  };
}

export function mapArrival(row, items = []) {
  return {
    id: row.id,
    sourceRef: row.source_ref,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    items: items.map((i) => ({ productName: i.product_name, qty: Number(i.qty), unit: i.unit })),
    totalQty: Number(row.total_qty),
    expectedDate: row.expected_date ?? "",
    expectedTime: row.expected_time,
    destination: row.destination,
    remarks: row.remarks ?? "",
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

export function mapReceipt(row, items = []) {
  const conditionSummary = { good: 0, damaged: 0, rejected: 0 };
  const mappedItems = items.map((i) => {
    const qty = Number(i.qty);
    if (conditionSummary[i.condition_value] != null) conditionSummary[i.condition_value] += qty;
    return {
      productName: i.product_name,
      qty,
      unit: i.unit,
      condition: i.condition_value,
      totalQty: i.total_received_quantity == null ? undefined : Number(i.total_received_quantity),
    };
  });
  return {
    id: row.id,
    arrivalId: row.arrival_id ?? "",
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status ?? "confirmed",
    items: mappedItems,
    totalQty: Number(row.total_qty),
    conditionSummary,
    receivedAt: toIso(row.received_at),
    receivingBy: row.receiving_by,
    docRef: row.doc_ref ?? "",
    remarks: row.remarks ?? "",
  };
}

export function mapNotification(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    read: Boolean(row.is_read),
    timestamp: toIso(row.created_at),
  };
}

/* Fulfillment is DERIVED from actual receiving records (GOOD qty only),
   never guessed or stored as a fake number. */
export function mapRequestFulfillment(items, receiptRows = []) {
  const received = new Map();
  for (const r of receiptRows) {
    const key = `${r.product_name}::${r.unit}`;
    if (r.condition_value !== "good") continue;
    received.set(key, round3((received.get(key) ?? 0) + Number(r.qty)));
  }
  const lines = items.map((it) => {
    const key = `${it.product_name}::${it.unit}`;
    const requested = Number(it.quantity);
    const fulfilled = round3(received.get(key) ?? 0);
    return {
      productId: it.product_id ?? null,
      productName: it.product_name,
      unit: it.unit,
      requestedQty: requested,
      fulfilledQty: fulfilled,
      remainingQty: round3(Math.max(0, requested - fulfilled)),
    };
  });
  const anyFulfilled = lines.some((l) => l.fulfilledQty > 0);
  const allFulfilled = lines.length > 0 && lines.every((l) => l.remainingQty <= 0);
  return {
    items: lines,
    progress: allFulfilled ? "fulfilled" : anyFulfilled ? "partial" : "new",
  };
}

export function mapSupplyRequest(row, items = [], fulfillment = { items: [], progress: "new" }) {
  return {
    id: row.id,
    requestedBy: row.requested_by,
    requestDate: toIso(row.request_date),
    neededByDate: row.needed_by_date ?? "",
    priority: row.priority,
    reason: row.reason ?? "",
    remarks: row.remarks ?? "",
    status: row.status,
    submittedAt: toIso(row.submitted_at),
    scReference: row.sc_reference ?? "",
    processingStatus: row.processing_status ?? "",
    supplierId: row.supplier_id ?? "",
    supplierName: row.supplier_name ?? "",
    expectedDeliveryDate: row.expected_delivery_date ?? "",
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id ?? null,
      productName: i.product_name,
      qty: Number(i.quantity),
      unit: i.unit,
      remarks: i.remarks ?? "",
    })),
    fulfillment,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapApplication(row, extra = {}) {
  return {
    id: row.id,
    companyName: row.company_name,
    businessRegNo: row.business_reg_no,
    tin: row.tin,
    address: row.address,
    email: row.email,
    phone: row.phone,
    website: row.website ?? "",
    distributionArea: row.distribution_area ?? "",
    contactName: row.contact_name,
    contactPosition: row.contact_position,
    supplierType: row.supplier_type,
    yearsInBusiness: row.years_in_business ?? null,
    status: row.status,
    approvedSupplierId: row.approved_supplier_id ?? "",
    revisionNote: row.revision_note ?? "",
    rejectionReason: row.rejection_reason ?? "",
    submittedAt: toIso(row.submitted_at),
    updatedAt: toIso(row.updated_at),
    products: extra.products ?? [],
    documents: extra.documents ?? [],
    timeline: extra.timeline ?? [],
  };
}

export function mapEvaluation(row, criteria = []) {
  const total = criteria.reduce((a, c) => a + (c.weight * c.score) / 100, 0);
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? "",
    comment: row.comment ?? "",
    scores: criteria.reduce((acc, c) => { acc[c.criterion] = c.score; return acc; }, {}),
    total: Math.round(total * 100) / 100,
    createdAt: toIso(row.created_at),
  };
}

export function mapAuditLog(row) {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity_type,
    entityId: row.entity_id,
    actor: row.actor_name || (row.user_id != null ? `User #${row.user_id}` : "System"),
    details: row.detail ?? "",
    timestamp: toIso(row.created_at),
  };
}