import {
  calculateCombinations,
  compareCombinations,
  getStatus,
} from "./core/calculator.js";

const IN_TO_MM = 25.4;
const DEFAULT_RESULT_LIMIT = 20;
const MAX_RESULT_LIMIT = 100;
const MIN_RING = 20;
const MAX_RING = 60;
const MIN_COG = 7;
const MAX_COG = 52;
const SETUP_PROPERTY_NAMES = Object.freeze([
  "units",
  "chainrings",
  "rearCogs",
  "wheelDiameter",
  "chainstayLength",
  "dropoutTravel",
  "targetGearInches",
  "gearTolerance",
  "includeHalfLink",
]);

export const WEBMCP_TOOL_NAMES = Object.freeze([
  "get_current_bike_setup",
  "calculate_gearing_options",
  "show_gearing_setup",
]);

const measurementUnitSchema = {
  type: "string",
  enum: ["metric", "imperial"],
  description:
    "Unit used by wheelDiameter, chainstayLength, and dropoutTravel. " +
    "Metric values are millimetres; imperial values are inches.",
};

const chainringSchema = {
  type: "array",
  description: "Chainring tooth counts to compare.",
  items: {
    type: "integer",
    minimum: MIN_RING,
    maximum: MAX_RING,
  },
  minItems: 1,
  uniqueItems: true,
};

const rearCogSchema = {
  type: "array",
  description: "Rear cog tooth counts to compare.",
  items: {
    type: "integer",
    minimum: MIN_COG,
    maximum: MAX_COG,
  },
  minItems: 1,
  uniqueItems: true,
};

function createSetupProperties({ includeResultLimit = false } = {}) {
  const properties = {
    units: measurementUnitSchema,
    chainrings: chainringSchema,
    rearCogs: rearCogSchema,
    wheelDiameter: {
      type: "number",
      exclusiveMinimum: 0,
      description:
        "Outer diameter of the inflated tire, in the selected measurement " +
        "units. Accepted range: 100–2000 mm or 4–80 in.",
    },
    chainstayLength: {
      type: "number",
      exclusiveMinimum: 0,
      description:
        "Distance from the bottom-bracket centre to the rear-axle centre, " +
        "in the selected measurement units. Accepted range: 50–1000 mm or " +
        "2–40 in.",
    },
    dropoutTravel: {
      type: "number",
      minimum: 0,
      description:
        "Available axle movement in either direction from the measured " +
        "chainstay length, in the selected measurement units. Accepted " +
        "range: 0–250 mm or 0–10 in.",
    },
    targetGearInches: {
      type: "number",
      minimum: 1,
      maximum: 500,
      description: "Desired pedalling difficulty expressed in gear inches.",
    },
    gearTolerance: {
      type: "number",
      minimum: 0,
      maximum: 500,
      description: "Allowed difference above or below targetGearInches.",
    },
    includeHalfLink: {
      type: "boolean",
      default: false,
      description:
        "Whether to include the extra chain positions made possible by a half-link.",
    },
  };

  if (includeResultLimit) {
    properties.maxResults = {
      type: "integer",
      minimum: 1,
      maximum: MAX_RESULT_LIMIT,
      default: DEFAULT_RESULT_LIMIT,
      description:
        "Maximum number of ranked combinations to return. " +
        "The response still reports the total number calculated.",
    };
  }

  return properties;
}

function createSetupSchema(options) {
  return {
    type: "object",
    properties: createSetupProperties(options),
    required: [
      "units",
      "chainrings",
      "rearCogs",
      "wheelDiameter",
      "chainstayLength",
      "dropoutTravel",
      "targetGearInches",
      "gearTolerance",
    ],
    additionalProperties: false,
  };
}

function fail(message) {
  throw new TypeError(message);
}

function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("Tool input must be an object.");
  }
}

function assertKnownProperties(input, { allowResultLimit }) {
  const allowed = new Set(SETUP_PROPERTY_NAMES);

  if (allowResultLimit) {
    allowed.add("maxResults");
  }

  const unknown = Object.keys(input).filter((name) => !allowed.has(name));

  if (unknown.length > 0) {
    fail(`Unknown tool input ${unknown.join(", ")}.`);
  }
}

function normalizeToothCounts(
  value,
  { label, minimum, maximum, allowEmptySelections },
) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`);
  }

  if (!allowEmptySelections && value.length === 0) {
    fail(`${label} must contain at least one tooth count.`);
  }

  const counts = value.map((count) => {
    if (!Number.isInteger(count) || count < minimum || count > maximum) {
      fail(
        `${label} values must be whole numbers from ${minimum} to ${maximum}.`,
      );
    }

    return count;
  });

  if (new Set(counts).size !== counts.length) {
    fail(`${label} must not contain duplicate tooth counts.`);
  }

  return [...counts].sort((a, b) => a - b);
}

function normalizeNumber(value, { label, minimum, maximum }) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    fail(`${label} must be a number from ${minimum} to ${maximum}.`);
  }

  return value;
}

function normalizeBoolean(value, { label, defaultValue = false }) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    fail(`${label} must be true or false.`);
  }

  return value;
}

export function normalizeGearingSetup(
  input,
  { allowEmptySelections = false, allowResultLimit = false } = {},
) {
  assertObject(input);
  assertKnownProperties(input, { allowResultLimit });

  if (input.units !== "metric" && input.units !== "imperial") {
    fail('units must be either "metric" or "imperial".');
  }

  const metric = input.units === "metric";

  return {
    units: input.units,
    chainrings: normalizeToothCounts(input.chainrings, {
      label: "chainrings",
      minimum: MIN_RING,
      maximum: MAX_RING,
      allowEmptySelections,
    }),
    rearCogs: normalizeToothCounts(input.rearCogs, {
      label: "rearCogs",
      minimum: MIN_COG,
      maximum: MAX_COG,
      allowEmptySelections,
    }),
    wheelDiameter: normalizeNumber(input.wheelDiameter, {
      label: "wheelDiameter",
      minimum: metric ? 100 : 4,
      maximum: metric ? 2000 : 80,
    }),
    chainstayLength: normalizeNumber(input.chainstayLength, {
      label: "chainstayLength",
      minimum: metric ? 50 : 2,
      maximum: metric ? 1000 : 40,
    }),
    dropoutTravel: normalizeNumber(input.dropoutTravel, {
      label: "dropoutTravel",
      minimum: 0,
      maximum: metric ? 250 : 10,
    }),
    targetGearInches: normalizeNumber(input.targetGearInches, {
      label: "targetGearInches",
      minimum: 1,
      maximum: 500,
    }),
    gearTolerance: normalizeNumber(input.gearTolerance, {
      label: "gearTolerance",
      minimum: 0,
      maximum: 500,
    }),
    includeHalfLink: normalizeBoolean(input.includeHalfLink, {
      label: "includeHalfLink",
    }),
  };
}

function round(value, decimalPlaces = 4) {
  return Number(value.toFixed(decimalPlaces));
}

function formatCombination(item, units) {
  const positionScale = units === "metric" ? IN_TO_MM : 1;

  return {
    status: getStatus(item),
    chainringTeeth: item.ring,
    rearCogTeeth: item.cog,
    gearInches: round(item.gearInches),
    gearError: round(item.gearError),
    chainType: item.isHalfLink ? "half-link" : "standard",
    chainLengthInches: item.chainLength,
    chainLinks: item.chainLength * 2,
    requiredChainstay: round(item.requiredChainstayIn * positionScale),
    axleShift: round(item.axleShiftIn * positionScale),
    matchesTarget: item.gearMatch,
    fitsDropout: item.dropoutMatch,
  };
}

function toEngineInput(setup) {
  const distanceScale = setup.units === "metric" ? 1 / IN_TO_MM : 1;

  return {
    rings: setup.chainrings,
    cogs: setup.rearCogs,
    wheelDiameterIn: setup.wheelDiameter * distanceScale,
    chainstayIn: setup.chainstayLength * distanceScale,
    targetGearInches: setup.targetGearInches,
    gearTolerance: setup.gearTolerance,
    dropoutTravelIn: setup.dropoutTravel * distanceScale,
  };
}

export function calculateGearingOptions(
  input,
  { allowEmptySelections = false } = {},
) {
  const setup = normalizeGearingSetup(input, {
    allowEmptySelections,
    allowResultLimit: true,
  });
  const maxResults = normalizeNumber(input.maxResults ?? DEFAULT_RESULT_LIMIT, {
    label: "maxResults",
    minimum: 1,
    maximum: MAX_RESULT_LIMIT,
  });

  if (!Number.isInteger(maxResults)) {
    fail("maxResults must be a whole number.");
  }

  const ranked = calculateCombinations(toEngineInput(setup))
    .filter((item) => setup.includeHalfLink || !item.isHalfLink)
    .sort(compareCombinations);

  const statusCounts = {
    goldilocks: 0,
    fitsDropout: 0,
    gearMatch: 0,
    outside: 0,
  };

  for (const item of ranked) {
    if (item.goldilocks) statusCounts.goldilocks++;
    else if (item.dropoutMatch) statusCounts.fitsDropout++;
    else if (item.gearMatch) statusCounts.gearMatch++;
    else statusCounts.outside++;
  }

  const combinations = ranked
    .slice(0, maxResults)
    .map((item) => formatCombination(item, setup.units));

  return {
    success: true,
    application: "CogSmith",
    setup,
    positionUnit: setup.units === "metric" ? "mm" : "in",
    totalCombinations: ranked.length,
    returnedCombinations: combinations.length,
    statusCounts,
    bestCombination: combinations[0] ?? null,
    combinations,
  };
}

function safeToolExecution(operation) {
  try {
    return operation();
  } catch (error) {
    return {
      success: false,
      application: "CogSmith",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createCogSmithWebMcpTools({ readCurrentSetup, applySetup }) {
  if (typeof readCurrentSetup !== "function") {
    fail("readCurrentSetup must be a function.");
  }

  if (typeof applySetup !== "function") {
    fail("applySetup must be a function.");
  }

  return [
    {
      name: "get_current_bike_setup",
      title: "Get current bike setup",
      description:
        "Read the bike setup currently displayed in CogSmith and return a " +
        "ranked gearing summary. Use this when the user refers to this bike, " +
        "the current setup, or values already entered on the page. This tool " +
        "does not change the page.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      execute: async () =>
        safeToolExecution(() =>
          calculateGearingOptions(readCurrentSetup(), {
            allowEmptySelections: true,
          }),
        ),
    },
    {
      name: "calculate_gearing_options",
      title: "Calculate gearing options",
      description:
        "Calculate and rank single-speed or fixed-gear chainring and rear-cog " +
        "combinations for an explicitly supplied bike setup. Use this for " +
        "comparisons or recommendations without changing the visible CogSmith " +
        "calculator. Gear inches remain imperial regardless of measurement units.",
      inputSchema: createSetupSchema({ includeResultLimit: true }),
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      execute: async (input) =>
        safeToolExecution(() => calculateGearingOptions(input)),
    },
    {
      name: "show_gearing_setup",
      title: "Show gearing setup",
      description:
        "Replace the values shown in CogSmith with an explicitly supplied bike " +
        "setup and recalculate the chart, summary, and results table for the " +
        "user to inspect. Use only when the user wants the visible page updated.",
      inputSchema: createSetupSchema(),
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      execute: async (input) =>
        safeToolExecution(() => {
          const setup = normalizeGearingSetup(input);
          applySetup(setup);

          return {
            ...calculateGearingOptions(readCurrentSetup()),
            message: "CogSmith now displays the supplied bike setup.",
          };
        }),
    },
  ];
}

export function findWebMcpModelContext({
  documentObject = globalThis.document,
  navigatorObject = globalThis.navigator,
} = {}) {
  if (typeof documentObject?.modelContext?.registerTool === "function") {
    return documentObject.modelContext;
  }

  if (typeof navigatorObject?.modelContext?.registerTool === "function") {
    return navigatorObject.modelContext;
  }

  return null;
}

export async function registerCogSmithWebMcp({
  readCurrentSetup,
  applySetup,
  documentObject = globalThis.document,
  navigatorObject = globalThis.navigator,
  logger = globalThis.console,
}) {
  const modelContext = findWebMcpModelContext({
    documentObject,
    navigatorObject,
  });

  if (!modelContext) {
    return {
      supported: false,
      registered: [],
      failed: [],
    };
  }

  const tools = createCogSmithWebMcpTools({
    readCurrentSetup,
    applySetup,
  });
  const registered = [];
  const failed = [];

  for (const tool of tools) {
    try {
      await modelContext.registerTool(tool);
      registered.push(tool.name);
    } catch (error) {
      failed.push(tool.name);
      logger?.warn?.(
        `CogSmith could not register the WebMCP tool ${tool.name}:`,
        error,
      );
    }
  }

  return {
    supported: true,
    registered,
    failed,
  };
}
