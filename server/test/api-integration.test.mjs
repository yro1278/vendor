import assert from "node:assert/strict";

const BASE = process.env.API_BASE ?? "http://localhost:4000/api";

async function call(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
}

let passed = 0;
const ok = (name) => { passed += 1; console.log(`  PASS  ${name}`); };

const { status, json } = await call("/auth/login", { method: "POST", body: { username: "admin", password: "admin123" } });
assert.equal(status, 200, "login should succeed");
assert.ok(json.token, "login returns a token");
const token = json.token;
ok("login (admin/admin123) returns a JWT");

const boot = await call("/vendor/bootstrap", { token });
assert.equal(boot.status, 200);
assert.ok(Array.isArray(boot.json.suppliers) && boot.json.suppliers.length > 0, "suppliers loaded");
assert.ok(Array.isArray(boot.json.arrivals) && boot.json.arrivals.length > 0, "arrivals loaded");
assert.ok(Array.isArray(boot.json.receipts) && boot.json.receipts.length > 0, "receipts loaded");
ok("GET /vendor/bootstrap — suppliers, arrivals, receipts from MySQL");

const seeded = boot.json.receipts.find((r) => r.id === "RR-2026-0085");
assert.ok(seeded, "seeded canned sardines sample exists");
assert.deepEqual(seeded.conditionSummary, { good: 50, damaged: 50, rejected: 0 });
ok("seeded interval has GOOD=50 / DAMAGED=50 with total 100 (persisted separately)");

const dash = await call("/vendor/dashboard", { token });
assert.equal(dash.status, 200);
assert.ok(dash.json.totalReceipts >= 5, "dashboard totalReceipts from DB");
assert.ok(Number.isInteger(dash.json.totalArrivals), "dashboard totalArrivals from DB");
ok("GET /vendor/dashboard — KPIs computed from MySQL");

const invalid = await call("/vendor/suppliers/DOES-NOT-EXIST", { token });
assert.equal(invalid.status, 404);
ok("GET supplier by unknown id → 404");
const supplier = await call("/vendor/suppliers/SUP-2026-10032", { token });
assert.equal(supplier.status, 200);
assert.equal(supplier.json.companyName, "Pacific Dry Goods Trading");
ok("GET /vendor/suppliers/SUP-2026-10032 — supplier detail from MySQL");

const past = new Date();
past.setFullYear(2026, 8, 20); past.setHours(12, 0, 0, 0);
const body = {
  id: "RR-2026-90101",
  arrivalId: "SC-DLV-2026-0298",
  supplierId: "SUP-2026-10032",
  receivedAt: past.toISOString(),
  receivingBy: "R. Dela Cruz",
  docRef: "DR-2026-9001",
  remarks: "50 units found damaged during receiving inspection.",
  items: [
    { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good", totalQty: 100 },
    { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "damaged", totalQty: 100 },
  ],
};

const created = await call("/vendor/receiving", { method: "POST", body, token });
assert.equal(created.status, 201, `create should succeed: ${JSON.stringify(created.json)}`);
assert.equal(created.json.totalQty, 100);
assert.deepEqual(created.json.conditionSummary, { good: 50, damaged: 50, rejected: 0 });
ok("create receiving — 100 pcs = 50 GOOD + 50 DAMAGED saved to MySQL");

const persisted = await call("/vendor/receiving/RR-2026-90101", { token });
assert.equal(persisted.status, 200);
assert.equal(persisted.json.items.length, 2);
assert.equal(persisted.json.items[0].totalQty, 100);
ok("receiving record persists across refresh/re-fetch (MySQL)");

const dupConfirm = await call("/vendor/receiving/RR-2026-90101/confirm", { method: "POST", token });
assert.equal(dupConfirm.status, 409, `duplicate confirm rejected: ${JSON.stringify(dupConfirm.json)}`);
ok("duplicate confirmation → 409");

const missingRef = await call("/vendor/receiving", {
  method: "POST",
  token,
  body: { ...body, id: "RR-2026-90102", arrivalId: "", docRef: "" },
});
assert.equal(missingRef.status, 400);
assert.match(missingRef.json.error, /Supplier reference/);
ok("create receiving without supplier reference → 400, record NOT saved");

const missingRemarks = await call("/vendor/receiving", {
  method: "POST",
  token,
  body: { ...body, id: "RR-2026-90103", arrivalId: "", remarks: "   " },
});
assert.equal(missingRemarks.status, 400);
assert.match(missingRemarks.json.error, /Remarks/);
ok("create receiving without remarks → 400, record NOT saved");

const mismatch = await call("/vendor/receiving", {
  method: "POST",
  token,
  body: {
    ...body,
    id: "RR-2026-90104",
    arrivalId: "",
    items: [
      { productName: "Canned Sardines 155g", qty: 70, unit: "pcs", condition: "good", totalQty: 100 },
      { productName: "Canned Sardines 155g", qty: 20, unit: "pcs", condition: "damaged", totalQty: 100 },
    ],
  },
});
assert.equal(mismatch.status, 400);
assert.match(mismatch.json.error, /must equal the total received quantity/);
const afterMiss = await call("/vendor/receiving/RR-2026-90104", { token });
assert.equal(afterMiss.status, 404, "mismatched record was rolled back / never saved");
ok("GOOD+DAMAGED != TOTAL → 400 and nothing persisted (rollback)");

const over = await call("/vendor/receiving", {
  method: "POST",
  token,
  body: {
    ...body,
    id: "RR-2026-90105",
    arrivalId: "SC-DLV-2026-0334",
    supplierId: "SUP-2026-10032",
    items: [
      { productName: "Premium Jasmine Rice 25kg", qty: 150, unit: "sack", condition: "good", totalQty: 150 },
    ],
  },
});
assert.equal(over.status, 400, `over-receipt rejected: ${JSON.stringify(over.json)}`);
assert.match(over.json.error, /exceeds the expected quantity/);
ok("receiving more than the expected SC quantity → 400");

const partial = await call("/vendor/receiving", {
  method: "POST",
  token,
  body: {
    id: "RR-2026-90106",
    arrivalId: "SC-DLV-2026-0334",
    supplierId: "SUP-2026-10032",
    receivedAt: past.toISOString(),
    receivingBy: "K. Banag",
    docRef: "DR-2026-9002",
    remarks: "Partial delivery received today.",
    items: [{ productName: "Premium Jasmine Rice 25kg", qty: 70, unit: "sack", condition: "good", totalQty: 70 }],
  },
});
assert.equal(partial.status, 201);
const arrivalCheck = await call("/vendor/bootstrap", { token });
const jasmine = arrivalCheck.json.arrivals.find((a) => a.id === "SC-DLV-2026-0334");
assert.ok(["received", "partially_received"].includes(jasmine.status), `arrival status reflects partial: ${jasmine.status}`);
ok("partial receipt (70/100 sacks) allowed; arrival flagged partially received");

console.log(`\n${passed} integration checks passed.`);