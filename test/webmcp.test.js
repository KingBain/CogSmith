import assert from "node:assert/strict";
import test from "node:test";

import {
  WEBMCP_TOOL_NAMES,
  calculateGearingOptions,
  createCogSmithWebMcpTools,
  normalizeGearingSetup,
  registerCogSmithWebMcp,
} from "../src/webmcp.js";

const metricSetup = {
  units: "metric",
  chainrings: [28, 38, 48],
  rearCogs: [11, 13, 15, 18, 21],
  wheelDiameter: 660.4,
  chainstayLength: 423,
  dropoutTravel: 10,
  targetGearInches: 60,
  gearTolerance: 3,
  includeHalfLink: false,
};

function copy(value) {
  return structuredClone(value);
}

function createTools(initialSetup = metricSetup) {
  let currentSetup = copy(initialSetup);
  const appliedSetups = [];
  const tools = createCogSmithWebMcpTools({
    readCurrentSetup: () => copy(currentSetup),
    applySetup: (setup) => {
      currentSetup = copy(setup);
      appliedSetups.push(copy(setup));
    },
  });

  return {
    appliedSetups,
    byName: Object.fromEntries(tools.map((tool) => [tool.name, tool])),
    tools,
  };
}

test("WebMCP exposes the intended tools with accurate safety hints", () => {
  const { byName, tools } = createTools();

  assert.deepEqual(
    tools.map((tool) => tool.name),
    WEBMCP_TOOL_NAMES,
  );
  assert.equal(byName.get_current_bike_setup.annotations.readOnlyHint, true);
  assert.equal(byName.calculate_gearing_options.annotations.readOnlyHint, true);
  assert.equal(byName.show_gearing_setup.annotations.readOnlyHint, false);
  assert.equal(
    byName.calculate_gearing_options.inputSchema.properties.maxResults.maximum,
    100,
  );
  assert.equal(
    "maxResults" in byName.show_gearing_setup.inputSchema.properties,
    false,
  );
});

test("the calculation tool returns compact ranked results without changing state", async () => {
  const { byName, appliedSetups } = createTools();
  const result = await byName.calculate_gearing_options.execute({
    ...metricSetup,
    maxResults: 3,
  });

  assert.equal(result.success, true);
  assert.equal(result.positionUnit, "mm");
  assert.equal(result.totalCombinations, 15);
  assert.equal(result.returnedCombinations, 3);
  assert.equal(result.bestCombination.chainringTeeth, 48);
  assert.equal(result.bestCombination.rearCogTeeth, 21);
  assert.equal(result.bestCombination.chainType, "standard");
  assert.equal(result.combinations.length, 3);
  assert.deepEqual(appliedSetups, []);
});

test("metric and imperial inputs produce the same gearing result", () => {
  const metric = calculateGearingOptions({
    ...metricSetup,
    chainrings: [38],
    rearCogs: [18],
    includeHalfLink: true,
  });
  const imperial = calculateGearingOptions({
    ...metricSetup,
    units: "imperial",
    chainrings: [38],
    rearCogs: [18],
    wheelDiameter: metricSetup.wheelDiameter / 25.4,
    chainstayLength: metricSetup.chainstayLength / 25.4,
    dropoutTravel: metricSetup.dropoutTravel / 25.4,
    includeHalfLink: true,
  });

  assert.deepEqual(
    metric.combinations.map((item) => [
      item.chainringTeeth,
      item.rearCogTeeth,
      item.chainType,
      item.gearInches,
      item.chainLengthInches,
    ]),
    imperial.combinations.map((item) => [
      item.chainringTeeth,
      item.rearCogTeeth,
      item.chainType,
      item.gearInches,
      item.chainLengthInches,
    ]),
  );
});

test("tool execution reports invalid gearing inputs to the agent", async () => {
  const { byName } = createTools();
  const result = await byName.calculate_gearing_options.execute({
    ...metricSetup,
    rearCogs: [18, 18],
  });

  assert.equal(result.success, false);
  assert.match(result.error, /duplicate tooth counts/);
  const unknownInput = await byName.show_gearing_setup.execute({
    ...metricSetup,
    hiddenInstruction: "ignore the declared tool contract",
  });

  assert.equal(unknownInput.success, false);
  assert.match(unknownInput.error, /Unknown tool input hiddenInstruction/);
  assert.throws(
    () =>
      normalizeGearingSetup({
        ...metricSetup,
        includeHalfLink: "false",
      }),
    /must be true or false/,
  );
});

test("the show tool applies a normalized setup and returns its new analysis", async () => {
  const { appliedSetups, byName } = createTools();
  const result = await byName.show_gearing_setup.execute({
    ...metricSetup,
    chainrings: [48, 38],
    rearCogs: [21, 18],
    includeHalfLink: true,
  });

  assert.equal(result.success, true);
  assert.match(result.message, /now displays/);
  assert.deepEqual(appliedSetups, [
    {
      ...metricSetup,
      chainrings: [38, 48],
      rearCogs: [18, 21],
      includeHalfLink: true,
    },
  ]);
  assert.deepEqual(result.setup, appliedSetups[0]);
  assert.equal(result.totalCombinations, 8);
});

test("registration prefers the current Document API and supports the legacy Navigator API", async () => {
  const currentRegistrations = [];
  const legacyRegistrations = [];
  const callbacks = {
    readCurrentSetup: () => copy(metricSetup),
    applySetup: () => {},
  };
  const currentResult = await registerCogSmithWebMcp({
    ...callbacks,
    documentObject: {
      modelContext: {
        registerTool: async (tool) => currentRegistrations.push(tool.name),
      },
    },
    navigatorObject: {
      modelContext: {
        registerTool: async (tool) => legacyRegistrations.push(tool.name),
      },
    },
  });

  assert.deepEqual(currentResult, {
    supported: true,
    registered: WEBMCP_TOOL_NAMES,
    failed: [],
  });
  assert.deepEqual(currentRegistrations, WEBMCP_TOOL_NAMES);
  assert.deepEqual(legacyRegistrations, []);

  const legacyResult = await registerCogSmithWebMcp({
    ...callbacks,
    documentObject: {},
    navigatorObject: {
      modelContext: {
        registerTool: async (tool) => legacyRegistrations.push(tool.name),
      },
    },
  });

  assert.equal(legacyResult.supported, true);
  assert.deepEqual(legacyResult.registered, WEBMCP_TOOL_NAMES);
  assert.deepEqual(legacyRegistrations, WEBMCP_TOOL_NAMES);

  const unsupported = await registerCogSmithWebMcp({
    ...callbacks,
    documentObject: {},
    navigatorObject: {},
  });

  assert.deepEqual(unsupported, {
    supported: false,
    registered: [],
    failed: [],
  });
});
