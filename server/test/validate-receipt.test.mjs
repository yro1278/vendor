import assert from "node:assert/strict";
import { validateReceiptPayload } from "../src/store.js";
import { mapReceipt } from "../src/util.js";

const VALID_ITEMS = [{ productName: "Canned Sardines 155g", qty: 100, unit: "pcs", condition: "good" }];

function validBody(overrides = {}) {
  return {
    id: "RR-2026-90001",
    supplierId: "SUP-2026-10032",
    arrivalId: "",
    receivedAt: "2026-09-20T09:30:00.000Z",
    receivingBy: "R. Dela Cruz",
    docRef: "SCSC-2019-0000001",
    remarks: "Received in good order.",
    items: VALID_ITEMS,
    ...overrides,
  };
}

function expectValidationError(body, keyMatch) {
  let threw = false;
  try {
    validateReceiptPayload(body, { requireId: true });
  } catch (err) {
    threw = true;
    assert.equal(err.status, 400, `expected 400, got ${err.status}`);
    assert.ok(err.extra?.errors, "expected structured errors map");
    const matched = Object.values(err.extra.errors).join("\n");
    assert.ok(keyMatch.test(matched), `expected error matching ${keyMatch}, got: ${matched}`);
  }
  assert.ok(threw, "expected validation to reject this payload");
}

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

console.log("Recount — receiving validation tests\n");

// TEST 1: missing supplier reference
expectValidationError(validBody({ docRef: "" }), /Supplier reference is required/);
expectValidationError(validBody({ docRef: "   " }), /Supplier reference is required/);
ok("TEST 1 — missing supplier reference is rejected (validation throws before any DB write)");

// TEST 2: missing required remarks
expectValidationError(validBody({ remarks: "" }), /Remarks are required/);
expectValidationError(validBody({ remarks: "   " }), /Remarks are required/);
ok("TEST 2 — missing required remarks are rejected");

// other hard-required fields
expectValidationError(validBody({ receivingBy: "" }), /Received by is required/);
expectValidationError(validBody({ supplierId: "" }), /Supplier is required/);
expectValidationError(validBody({ receivedAt: "" }), /Received date\/time is required/);
expectValidationError(validBody({ items: [] }), /At least one receiving item is required/);
expectValidationError(validBody({ items: undefined }), /At least one receiving item is required/);
ok("Required header fields (supplier, received-by, datetime, items) are enforced");

// TEST 3: valid good/damaged split — 50 / 50 = total 100
{
  const res = validateReceiptPayload(validBody({
    items: [
      { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good", totalQty: 100 },
      { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "damaged", totalQty: 100 },
    ],
  }), { requireId: true });
  assert.equal(res.totalQty, 100);
  assert.equal(res.items[0].condition, "good");
  assert.equal(res.items[1].condition, "damaged");
  ok("TEST 3 — good 50 / damaged 50 equals total 100 and passes");
}

// TEST 4: quantity mismatch — good 70 / damaged 20 vs declared total 100
expectValidationError(validBody({
  items: [
    { productName: "Canned Sardines 155g", qty: 70, unit: "pcs", condition: "good", totalQty: 100 },
    { productName: "Canned Sardines 155g", qty: 20, unit: "pcs", condition: "damaged", totalQty: 100 },
  ],
}), /condition quantities \(90\) must equal the total received quantity \(100\)/);
ok("TEST 4 — declared-total mismatch (100 vs 70+20) is rejected");

// TEST 4b: a product split across condition rows MUST declare its total
expectValidationError(validBody({
  items: [
    { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good" },
    { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "damaged" },
  ],
}), /add the total received quantity/);
ok("TEST 4b — split-condition product without a declared total is rejected");

// TEST 4c: conflicting declared totals on the same product/unit
expectValidationError(validBody({
  items: [
    { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good", totalQty: 100 },
    { productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "damaged", totalQty: 120 },
  ],
}), /conflicting declared totals/);
ok("TEST 4c — conflicting declared totals on the same product/unit are rejected");

// TEST 4d: single condition row that under-declares its total (50 good vs 100 total)
expectValidationError(validBody({
  items: [{ productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good", totalQty: 100 }],
}), /condition quantities \(50\) must equal the total received quantity \(100\)/);
{
  const res = validateReceiptPayload(validBody({
    items: [{ productName: "Canned Sardines 155g", qty: 50, unit: "pcs", condition: "good" }],
  }), { requireId: true });
  assert.equal(res.totalQty, 50);
  ok("TEST 4d — single condition row without a declared total derives its own total (50)");
}
ok("TEST 4d — under-declared single-row total is rejected; derived total stays for single rows");

// TEST 5: all good items
{
  const res = validateReceiptPayload(validBody({
    items: [{ productName: "Canned Sardines 155g", qty: 100, unit: "pcs", condition: "good" }],
  }), { requireId: true });
  assert.equal(res.totalQty, 100);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].condition, "good");
  ok("TEST 5 — all-good quantity 100 passes, only a good line is recorded");
}

// TEST 6: all damaged items (fully damaged delivery is allowed)
{
  const res = validateReceiptPayload(validBody({
    items: [{ productName: "Canned Sardines 155g", qty: 100, unit: "pcs", condition: "damaged" }],
  }), { requireId: true });
  assert.equal(res.totalQty, 100);
  assert.equal(res.items[0].condition, "damaged");
  ok("TEST 6 — all-damaged quantity 100 passes; nothing recorded as good");
}

// quantity type rules
expectValidationError(validBody({ items: [{ productName: "Rice 25kg", qty: 1.5, unit: "pcs", condition: "good" }] }), /whole number/);
expectValidationError(validBody({ items: [{ productName: "Rice 25kg", qty: -5, unit: "pcs", condition: "good" }] }), /greater than zero/);
expectValidationError(validBody({ items: [{ productName: "Rice 25kg", qty: 0, unit: "pcs", condition: "good" }] }), /greater than zero/);
expectValidationError(validBody({ items: [{ productName: "Rice 25kg", qty: 12.3456, unit: "kg", condition: "good" }] }), /3 decimal places/);
{
  const res = validateReceiptPayload(validBody({ items: [{ productName: "Rice 25kg", qty: 12.55, unit: "kg", condition: "good" }] }), { requireId: true });
  assert.equal(res.totalQty, 12.55);
  ok("Fractional quantities allowed only for measure units (kg = 12.55)");
}
expectValidationError(validBody({ items: [{ productName: "Rice 25kg", qty: 1, unit: "pcs", condition: "expired" }] }), /Invalid receiving condition/);
ok("Integer-only for count units; zero/negative/fractional/unknown-condition quantities are rejected");

// mapReceipt — per-condition segregation survives serialization
{
  const built = mapReceipt(
    { id: "RR-2026-90001", arrival_id: "", supplier_id: "S", supplier_name: "Pacific Dry Goods Trading", status: "confirmed", total_qty: 170, received_at: "2026-09-20 09:30:00", receiving_by: "R. Dela Cruz", doc_ref: "DR-123", remarks: "ok" },
    [
      { product_name: "Canned Sardines 155g", qty: 100, unit: "pcs", condition_value: "good" },
      { product_name: "Canned Sardines 155g", qty: 50, unit: "pcs", condition_value: "damaged" },
      { product_name: "Canned Sardines 155g", qty: 20, unit: "pcs", condition_value: "rejected" },
    ]
  );
  assert.deepEqual(built.conditionSummary, { good: 100, damaged: 50, rejected: 20 });
  assert.equal(built.status, "confirmed");
  assert.equal(built.totalQty, 170);
  ok("Segregation preserved: good=100 / damaged=50 / rejected=20 kept separate in the record");
}

console.log(`\n${passed} checks passed.`);