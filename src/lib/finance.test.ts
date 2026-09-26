import test from "node:test";
import assert from "node:assert/strict";
import { commissionForSale } from "./finance";

test("calculates the brief's 1000 euro example", () => {
  const result = commissionForSale(1000, { Richard: 50, Anastasia: 30, "Jean-Claude": 20 });
  assert.deepEqual(result, { pool: 100, amounts: { Richard: 50, Anastasia: 30, "Jean-Claude": 20 } });
});

test("gives a rounding cent to the largest share", () => {
  const result = commissionForSale(10.01, { Richard: 50, Anastasia: 30, "Jean-Claude": 20 });
  assert.equal(result.pool, 1);
  assert.deepEqual(result.amounts, { Richard: 0.5, Anastasia: 0.3, "Jean-Claude": 0.2 });
});

test("breaks a largest-share tie in Richard's favour", () => {
  const result = commissionForSale(10.05, { Richard: 50, Anastasia: 50, "Jean-Claude": 0 });
  assert.deepEqual(result.amounts, { Richard: 0.51, Anastasia: 0.5, "Jean-Claude": 0 });
});
