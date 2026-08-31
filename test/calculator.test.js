import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCombinations,
  compareCombinations,
  getStatus,
  getStatusPriority
} from "../src/core/calculator.js";

const defaultInput = {
  rings: [28, 38, 48],
  cogs: [11, 13, 15, 18, 21],
  wheelDiameterIn: 700 / 25.4,
  chainstayIn: 423 / 25.4,
  targetGearInches: 60,
  gearTolerance: 2,
  dropoutTravelIn: 10 / 25.4
};

function assertClose(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("default selections preserve the established calculation results", () => {
  const combinations = calculateCombinations(defaultInput);
  const standard = combinations.find(item =>
    item.ring === 38 && item.cog === 18 && !item.isHalfLink
  );
  const halfLink = combinations.find(item =>
    item.ring === 38 && item.cog === 18 && item.isHalfLink
  );

  assert.equal(combinations.length, 30);
  assert.deepEqual(
    combinations.slice(0, 2).map(item => [
      item.ring,
      item.cog,
      item.isHalfLink
    ]),
    [[28, 11, false], [28, 11, true]]
  );

  assert.equal(standard.chainLength, 47);
  assertClose(standard.gearInches, 58.18022747156605);
  assertClose(standard.requiredChainstayIn, 16.422820270343983);
  assertClose(standard.axleShiftIn, -0.2307230367426314);
  assertClose(standard.score, 19.36979831099208);
  assert.equal(standard.goldilocks, true);

  assert.equal(halfLink.chainLength, 47.5);
  assertClose(halfLink.requiredChainstayIn, 16.673984635135426);
  assertClose(halfLink.axleShiftIn, 0.020441328048811158);
  assertClose(halfLink.score, 18.302567230827474);
  assert.equal(halfLink.goldilocks, true);
});

test("ranking preserves the established best combinations", () => {
  const ranked = calculateCombinations(defaultInput)
    .sort(compareCombinations)
    .slice(0, 5)
    .map(item => [item.ring, item.cog, item.isHalfLink]);

  assert.deepEqual(ranked, [
    [28, 13, true],
    [28, 13, false],
    [38, 18, true],
    [38, 18, false],
    [48, 21, false]
  ]);
});

test("status labels and priorities keep their existing order", () => {
  const statuses = [
    { goldilocks: true, gearMatch: true, dropoutMatch: true },
    { goldilocks: false, gearMatch: false, dropoutMatch: true },
    { goldilocks: false, gearMatch: true, dropoutMatch: false },
    { goldilocks: false, gearMatch: false, dropoutMatch: false }
  ];

  assert.deepEqual(
    statuses.map(getStatus),
    ["Goldilocks", "Fits dropout", "Gear match", "Outside"]
  );
  assert.deepEqual(statuses.map(getStatusPriority), [0, 1, 2, 3]);
});

test("the calculator does not mutate selected tooth counts", () => {
  const rings = [48, 28];
  const cogs = [21, 11];

  calculateCombinations({
    ...defaultInput,
    rings,
    cogs
  });

  assert.deepEqual(rings, [48, 28]);
  assert.deepEqual(cogs, [21, 11]);
});

test("impossible geometry is omitted from the results", () => {
  const combinations = calculateCombinations({
    ...defaultInput,
    rings: [60],
    cogs: [7],
    chainstayIn: 2
  });

  assert.deepEqual(combinations, []);
});
