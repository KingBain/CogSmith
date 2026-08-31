const CHAIN_PITCH_IN = 0.5;
const CHAIN_PHASE_SAMPLES = 32;
const GEOMETRY_EPSILON = 1e-12;

/*
 * Standard-chain rounding changes at x.5 inches, while half-link rounding
 * changes at whole inches. The belt and polygon paths stay within 0.007
 * inches across CogSmith's selectable tooth counts and 8–24 inch chainstays,
 * so a 0.01-inch window safely identifies results needing the exact check.
 */
const ROUNDING_BOUNDARY_TOLERANCE_IN = 0.01;

function sprocketRadius(teeth) {
  return teeth / (4 * Math.PI);
}

/*
 * Fast belt-style chain geometry.
 *
 * Treat the chainring and rear cog pitch circles as smooth pulleys. This is
 * the common path because it avoids building polygons and sampling multiple
 * rotational phases for every combination.
 */
export function chainPath(chainring, cog, chainstay) {
  const ringRadius = sprocketRadius(chainring);
  const cogRadius = sprocketRadius(cog);
  const difference = ringRadius - cogRadius;

  if (Math.abs(difference) >= chainstay) return NaN;

  const thetaDegrees =
    Math.acos(difference / chainstay) * 180 / Math.PI;

  return (
    (180 - thetaDegrees) * Math.PI * ringRadius +
    thetaDegrees * Math.PI * cogRadius +
    180 * Math.sqrt(chainstay ** 2 - difference ** 2)
  ) / 90;
}

function sprocketPitchRadius(teeth) {
  return CHAIN_PITCH_IN /
    (2 * Math.sin(Math.PI / teeth));
}

function buildPitchPolygon(teeth, centerX, phase) {
  const radius = sprocketPitchRadius(teeth);
  const points = [];

  for (let tooth = 0; tooth < teeth; tooth++) {
    const angle = phase + tooth * 2 * Math.PI / teeth;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    });
  }

  return points;
}

function geometryCross(origin, a, b) {
  return (
    (a.x - origin.x) * (b.y - origin.y) -
    (a.y - origin.y) * (b.x - origin.x)
  );
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x
  );
  const lower = [];
  const upper = [];

  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      geometryCross(
        lower[lower.length - 2],
        lower[lower.length - 1],
        point
      ) <= GEOMETRY_EPSILON
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (
      upper.length >= 2 &&
      geometryCross(
        upper[upper.length - 2],
        upper[upper.length - 1],
        point
      ) <= GEOMETRY_EPSILON
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function polygonChainPathForPhase(
  chainring,
  cog,
  chainstay,
  phaseFraction
) {
  const ringPhase =
    phaseFraction * 2 * Math.PI / chainring;
  const cogPhase =
    phaseFraction * 2 * Math.PI / cog;
  const hull = convexHull([
    ...buildPitchPolygon(chainring, 0, ringPhase),
    ...buildPitchPolygon(cog, chainstay, cogPhase)
  ]);

  let pathLength = 0;
  for (let index = 0; index < hull.length; index++) {
    const current = hull[index];
    const next = hull[(index + 1) % hull.length];
    pathLength += Math.hypot(
      next.x - current.x,
      next.y - current.y
    );
  }

  return pathLength;
}

export function discreteChainPath(chainring, cog, chainstay) {
  let maximumPath = -Infinity;

  for (let sample = 0; sample < CHAIN_PHASE_SAMPLES; sample++) {
    maximumPath = Math.max(
      maximumPath,
      polygonChainPathForPhase(
        chainring,
        cog,
        chainstay,
        sample / CHAIN_PHASE_SAMPLES
      )
    );
  }

  return maximumPath;
}

export function chainGeometryForRounding(
  chainring,
  cog,
  chainstay
) {
  const fastPath = chainPath(chainring, cog, chainstay);

  if (!Number.isFinite(fastPath)) {
    return {
      path: fastPath,
      pathCalculator: chainPath
    };
  }

  const boundaryDistance =
    Math.abs(fastPath * 2 - Math.round(fastPath * 2)) / 2;

  if (boundaryDistance > ROUNDING_BOUNDARY_TOLERANCE_IN) {
    return {
      path: fastPath,
      pathCalculator: chainPath
    };
  }

  const exactPath =
    discreteChainPath(chainring, cog, chainstay);

  if (!Number.isFinite(exactPath)) {
    return {
      path: fastPath,
      pathCalculator: chainPath
    };
  }

  return {
    path: exactPath,
    pathCalculator: discreteChainPath
  };
}

export function solveChainstay(
  chainring,
  cog,
  chainLength,
  approximateChainstay,
  pathCalculator = chainPath
) {
  let low = Math.max(2, approximateChainstay - 5);
  let high = approximateChainstay + 5;
  // Twenty bisections resolve the 10-inch discrete search window to well
  // below 0.001 mm without repeating the expensive polygon path 90 times.
  const iterations =
    pathCalculator === discreteChainPath ? 20 : 90;

  for (let i = 0; i < iterations; i++) {
    const midpoint = (low + high) / 2;
    const path = pathCalculator(chainring, cog, midpoint);
    if (!Number.isFinite(path) || path < chainLength) low = midpoint;
    else high = midpoint;
  }

  return (low + high) / 2;
}
