import {
  chainGeometryForRounding,
  solveChainstay
} from "./chain-geometry.js";

const IN_TO_MM = 25.4;

function buildSolution({
  ring,
  cog,
  gearInches,
  chainLength,
  isHalfLink,
  pathCalculator,
  chainstayIn,
  targetGearInches,
  gearTolerance,
  dropoutTravelIn
}) {
  const requiredChainstayIn = solveChainstay(
    ring,
    cog,
    chainLength,
    chainstayIn,
    pathCalculator
  );

  const axleShiftIn = requiredChainstayIn - chainstayIn;
  const gearError = Math.abs(gearInches - targetGearInches);
  const gearMatch = gearError <= gearTolerance;
  const dropoutMatch = Math.abs(axleShiftIn) <= dropoutTravelIn;
  const goldilocks = gearMatch && dropoutMatch;

  // Preserve the original ranking weight by expressing axle error in mm.
  // A tiny tie-break penalty keeps a standard chain ahead of an otherwise
  // identical half-link result.
  const score =
    gearError * 10 +
    Math.abs(axleShiftIn * IN_TO_MM) * 0.2 +
    (isHalfLink ? 0.001 : 0);

  return {
    ring,
    cog,
    gearInches,
    chainLength,
    requiredChainstayIn,
    axleShiftIn,
    gearError,
    gearMatch,
    dropoutMatch,
    goldilocks,
    isHalfLink,
    score
  };
}

export function calculateCombinations({
  rings,
  cogs,
  wheelDiameterIn,
  chainstayIn,
  targetGearInches,
  gearTolerance,
  dropoutTravelIn
}) {
  const combinations = [];

  for (const ring of rings) {
    for (const cog of cogs) {
      const gearInches = wheelDiameterIn * ring / cog;
      const chainGeometry = chainGeometryForRounding(
        ring,
        cog,
        chainstayIn
      );
      const theoreticalChain = chainGeometry.path;

      if (!Number.isFinite(theoreticalChain)) {
        continue;
      }

      // Standard chains use whole-inch lengths.
      const standardChainLength = Math.round(theoreticalChain);

      combinations.push(buildSolution({
        ring,
        cog,
        gearInches,
        chainLength: standardChainLength,
        isHalfLink: false,
        pathCalculator: chainGeometry.pathCalculator,
        chainstayIn,
        targetGearInches,
        gearTolerance,
        dropoutTravelIn
      }));

      // Half-links add an x.5-inch option; they do not replace the standard.
      const halfLinkChainLength =
        Math.round(theoreticalChain - 0.5) + 0.5;

      combinations.push(buildSolution({
        ring,
        cog,
        gearInches,
        chainLength: halfLinkChainLength,
        isHalfLink: true,
        pathCalculator: chainGeometry.pathCalculator,
        chainstayIn,
        targetGearInches,
        gearTolerance,
        dropoutTravelIn
      }));
    }
  }

  return combinations;
}

export function getStatus(item) {
  if (item.goldilocks) return "Goldilocks";
  if (item.gearMatch) return "Gear match";
  if (item.dropoutMatch) return "Fits dropout";
  return "Outside";
}

export function getStatusPriority(item) {
  if (item.goldilocks) return 0;
  if (item.dropoutMatch) return 1;
  if (item.gearMatch) return 2;
  return 3;
}

export function compareCombinations(a, b) {
  return (
    getStatusPriority(a) - getStatusPriority(b) ||
    a.score - b.score
  );
}
