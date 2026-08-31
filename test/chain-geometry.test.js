import assert from "node:assert/strict";
import test from "node:test";

import {
  chainGeometryForRounding,
  chainPath,
  discreteChainPath,
  solveChainstay
} from "../src/core/chain-geometry.js";

function assertClose(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("smooth chain geometry preserves the established path length", () => {
  assertClose(
    chainPath(38, 18, 423 / 25.4),
    47.45930423867191
  );
});

test("impossible sprocket spacing returns no finite chain path", () => {
  assert.ok(Number.isNaN(chainPath(60, 7, 2)));
});

test("rounding boundaries use the discrete roller geometry", () => {
  const result = chainGeometryForRounding(20, 42, 423 / 25.4);

  assert.equal(result.pathCalculator, discreteChainPath);
  assertClose(result.path, 48.99172705567605);
});

test("chainstay solver reproduces the requested chain length", () => {
  const requiredChainstay = solveChainstay(38, 18, 47.5, 423 / 25.4);

  assertClose(requiredChainstay, 16.673984635135426);
  assertClose(chainPath(38, 18, requiredChainstay), 47.5);
});
