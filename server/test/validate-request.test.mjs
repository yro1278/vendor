import assert from "node:assert/strict";
import { validateSupplyRequestPayload } from "../src/store.js";

function validBody(overrides = {}) {
  return {
    neededByDate: "2026-12-31",
    priority: "normal",
    reason: "Seasonal restock for Q4 campaign.",
    remarks: "Please prioritize by month-end.",
    items: [{ productId: 1, qty: 120, unit: "pcs", remarks: "" }],
    ...overrides,
  };
}

function expectValidationError(body, keyMatch) {
  let threw = false;
  try {
    validateSupplyRequestPayload(body);
  } catch (err) {
    threw = true;
    assert.equal(err.status, 400, `expected 400, got ${err.status}`);
    assert.ok(err.extra?.errors, "expected structured errors map");
    const matched = Object.values(err.extra.errors).join("\n");
    assert.ok(keyMatch.test(matched), `expected error matching ${keyMatch}, got: ${matched}`);
  }
  assert.ok(threw, "expected validation to reject this payload");
}

function expectRequireIdError(body, keyMatch) {
  let threw = false;
  try {
    validateSupplyRequestPayload(body, { requireId: true });
  } catch (err) {
    threw = true;
    const matched = Object.values(err.extra?.errors ?? {}).join("\n");
    assert.ok(keyMatch.test(matched), `expected error matching ${keyMatch}, got: ${matched}`);
  }
  assert.ok(threw, "expected requireId validation to reject this payload");
}

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

console.log("Supply Requests — request payload validation tests\n");

// TEST 1: needed-by date requirements
expectValidationError(validBody({ neededByDate: "" }), /Needed-by date is required/);
expectValidationError(validBody({ neededByDate: "  " }), /Needed-by date is required/);
expectValidationError(validBody({ neededByDate: "31-12-2026" }), /Needed-by date is required/);
expectValidationError(validBody({ neededByDate: "2020-01-01" }), /cannot be in the past/);
ok("TEST 1 — needed-by date must be present, valid YYYY-MM-DD, and not in the past");

{
  const res = validateSupplyRequestPayload(validBody({ neededByDate: "2026-12-31" }));
  assert.equal(res.neededBy, "2026-12-31");
  ok("TEST 1 — a future valid needed-by date passes");
}

// TEST 2: priority
expectValidationError(validBody({ priority: "urgentest" }), /Invalid priority/);
expectValidationError(validBody({ priority: "URGENT" }), /Invalid priority/);
{
  const res = validateSupplyRequestPayload(validBody({ priority: "urgent" }));
  assert.equal(res.priority, "urgent");
}
{
  const res = validateSupplyRequestPayload(validBody({ priority: "" }));
  assert.equal(res.priority, "normal");
}
ok("TEST 2 — priority must be low/normal/high/urgent; blank defaults to normal");

// TEST 3: reason / purpose
expectValidationError(validBody({ reason: "" }), /Reason \/ purpose is required/);
expectValidationError(validBody({ reason: "   " }), /Reason \/ purpose is required/);
expectValidationError(validBody({ reason: "x".repeat(501) }), /too long/);
ok("TEST 3 — reason required and capped at 500 characters");

// TEST 4: at least one item, max 30
expectValidationError(validBody({ items: [] }), /At least one requested supply item is required/);
expectValidationError(validBody({ items: undefined }), /At least one requested supply item is required/);
{
  const many = Array.from({ length: 30 }, (_, i) => ({ productId: i + 1, qty: 1, unit: "pcs" }));
  const res = validateSupplyRequestPayload(validBody({ items: many }));
  assert.equal(res.items.length, 30);
}
{
  const tooMany = Array.from({ length: 31 }, (_, i) => ({ productId: i + 1, qty: 1, unit: "pcs" }));
  expectValidationError(validBody({ items: tooMany }), /at most 30 items/);
}
ok("TEST 4 — 1..30 items enforced");

// TEST 5: product must resolve to a real DB product id
expectValidationError(validBody({ items: [{ productId: 0, qty: 1, unit: "pcs" }] }), /select a valid product/);
expectValidationError(validBody({ items: [{ productId: -4, qty: 1, unit: "pcs" }] }), /select a valid product/);
expectValidationError(validBody({ items: [{ productId: 1.5, qty: 1, unit: "pcs" }] }), /select a valid product/);
expectValidationError(validBody({ items: [{ productId: "", qty: 1, unit: "pcs" }] }), /select a valid product/);
expectValidationError(validBody({ items: [{ productId: 1, qty: 1, unit: "" }] }), /select a valid unit/);
ok("TEST 5 — invalid/blank product ids and blank units rejected");

// TEST 6: quantity rules — zero, negative, fractional count, fractional measure
expectValidationError(validBody({ items: [{ productId: 1, qty: 0, unit: "pcs" }] }), /greater than zero/);
expectValidationError(validBody({ items: [{ productId: 1, qty: -5, unit: "pcs" }] }), /greater than zero/);
expectValidationError(validBody({ items: [{ productId: 1, qty: 1.5, unit: "pcs" }] }), /whole number/);
expectValidationError(validBody({ items: [{ productId: 1, qty: 12.3456, unit: "kg" }] }), /3 decimal places/);
{
  const res = validateSupplyRequestPayload(validBody({ items: [{ productId: 1, qty: 12.55, unit: "kg" }] }));
  assert.equal(res.items[0].qty, 12.55);
  ok("TEST 6 — count units integer-only; measure units accept up to 3 decimals");
}

// TEST 7: no duplicate product+unit in one request
expectValidationError(validBody({
  items: [
    { productId: 1, qty: 10, unit: "pcs" },
    { productId: 1, qty: 20, unit: "pcs" },
  ],
}), /duplicate product in the same request/);
{
  const res = validateSupplyRequestPayload(validBody({
    items: [
      { productId: 1, qty: 10, unit: "pcs" },
      { productId: 1, qty: 0.5, unit: "kg" },
    ],
  }));
  assert.equal(res.items.length, 2);
  ok("TEST 7 — same product twice is rejected only when the unit is also identical");
}

// TEST 8: id format (requireId)
expectRequireIdError(validBody({ id: "" }), /Request reference is required/);
expectRequireIdError(validBody({ id: "VR 2026 1" }), /Invalid request reference/);
expectRequireIdError(validBody({ id: "VR".repeat(40) }), /Invalid request reference/);
ok("TEST 8 — requireId enforces a reference; invalid characters rejected");
{
  const res = validateSupplyRequestPayload(validBody({ id: "VR-2026-TEST01" }), { requireId: true });
  assert.equal(res.id, "VR-2026-TEST01");
}

// TEST 9: remarks trimmed and capped without rejection
{
  const res = validateSupplyRequestPayload(validBody({ remarks: "x".repeat(600) }));
  assert.equal(res.remarks.length, 500);
  assert.equal(res.remarks, "x".repeat(500));
}
ok("TEST 9 — long remarks are truncated to 500, not rejected");

console.log(`\n${passed} checks passed.`);