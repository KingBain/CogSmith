const $ = id => document.getElementById(id);

let unitSystem = "metric";

const IN_TO_MM = 25.4;
const IN_TO_CM = 2.54;

// Keep the current chart view when the calculator redraws, such as when
// half-link points are toggled on or off.
let chartZoomTransform = d3.zoomIdentity;
let activeChartZoom = null;
let activeChartSvg = null;

function uiWheelToInches(value) {
  return unitSystem === "metric" ? value / IN_TO_MM : value;
}

function uiChainstayToInches(value) {
  return unitSystem === "metric" ? value / IN_TO_MM : value;
}

function uiDropoutToInches(value) {
  return unitSystem === "metric" ? value / IN_TO_MM : value;
}

function inchesToUiChainstay(value) {
  return unitSystem === "metric" ? value * IN_TO_MM : value;
}

function inchesToUiDropout(value) {
  return unitSystem === "metric" ? value * IN_TO_MM : value;
}

function formatChainstay(inches) {
  return unitSystem === "metric"
    ? `${(inches * IN_TO_MM).toFixed(1)} mm`
    : `${inches.toFixed(3)} in`;
}

function formatShift(inches) {
  const sign = inches >= 0 ? "+" : "−";
  const absolute = Math.abs(inches);

  return unitSystem === "metric"
    ? `${sign}${(absolute * IN_TO_MM).toFixed(1)} mm`
    : `${sign}${absolute.toFixed(3)} in`;
}

function formatChainLength(inches) {
  if (unitSystem === "metric") {
    return `${(inches * IN_TO_CM).toFixed(1)} cm`;
  }

  return Number.isInteger(inches)
    ? `${inches.toFixed(0)} in`
    : `${inches.toFixed(1)} in`;
}

function setUnitSystem(next) {
  if (next === unitSystem) return;

  // Read current values into canonical inches before changing the mode.
  const wheelIn = uiWheelToInches(Number($("wheel").value));
  const chainstayIn = uiChainstayToInches(Number($("chainstay").value));
  const dropoutIn = uiDropoutToInches(Number($("dropout").value));

  unitSystem = next;

  if (unitSystem === "metric") {
    $("wheel").value = (wheelIn * IN_TO_MM).toFixed(1);
    $("chainstay").value = (chainstayIn * IN_TO_MM).toFixed(1);
    $("dropout").value = (dropoutIn * IN_TO_MM).toFixed(1);

    $("wheel").step = "1";
    $("chainstay").step = "1";
    $("dropout").step = "0.5";

    $("wheelLabel").textContent = "Wheel diameter (mm)";
    $("chainstayLabel").textContent = "Chainstay length (mm)";
    $("dropoutLabel").textContent = "Dropout travel ± (mm)";
  } else {
    $("wheel").value = wheelIn.toFixed(2);
    $("chainstay").value = chainstayIn.toFixed(3);
    $("dropout").value = dropoutIn.toFixed(3);

    $("wheel").step = "0.01";
    $("chainstay").step = "0.01";
    $("dropout").step = "0.01";

    $("wheelLabel").textContent = "Wheel diameter (in)";
    $("chainstayLabel").textContent = "Chainstay length (in)";
    $("dropoutLabel").textContent = "Dropout travel ± (in)";
  }

  $("metricUnits").setAttribute("aria-pressed", unitSystem === "metric");
  $("imperialUnits").setAttribute("aria-pressed", unitSystem === "imperial");

  update();
}

const MIN_RING = 20;
const MAX_RING = 60;

// Default chainrings shown on first load.
const defaultRings = [28, 38, 48];

function buildRingSelector() {
  const container = $("ringOptions");
  container.innerHTML = "";

  for (let ring = MIN_RING; ring <= MAX_RING; ring++) {
    const label = document.createElement("label");
    label.className = "cog-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = ring;
    checkbox.className = "ring-checkbox";
    checkbox.checked = defaultRings.includes(ring);

    const text = document.createElement("span");
    text.textContent = `${ring}T`;

    label.append(checkbox, text);
    container.appendChild(label);

    checkbox.addEventListener("change", () => {
      updateRingSummary();
      update();
    });
  }

  updateRingSummary();
}

function getSelectedRings() {
  return [...document.querySelectorAll(".ring-checkbox:checked")]
    .map(x => Number(x.value))
    .sort((a, b) => a - b);
}

function updateRingSummary() {
  const selected = getSelectedRings();
  const summary = $("ringSummary");

  if (!selected.length) {
    summary.textContent = "No chainrings selected";
  } else if (selected.length === MAX_RING - MIN_RING + 1) {
    summary.textContent = "All chainrings (20T–60T)";
  } else if (selected.length <= 6) {
    summary.textContent = selected.map(x => `${x}T`).join(", ");
  } else {
    summary.textContent = `${selected.length} chainrings selected`;
  }
}

$("selectAllRings").addEventListener("click", () => {
  document.querySelectorAll(".ring-checkbox").forEach(x => x.checked = true);
  updateRingSummary();
  update();
});

$("clearRings").addEventListener("click", () => {
  document.querySelectorAll(".ring-checkbox").forEach(x => x.checked = false);
  updateRingSummary();
  update();
});

function closeRingMenu() {
  $("ringDropdown").removeAttribute("open");
}

$("closeRingMenu").addEventListener("click", closeRingMenu);
$("doneRings").addEventListener("click", closeRingMenu);

const MIN_COG = 7;
const MAX_COG = 52;
const defaultCogs = [11, 13, 15, 18, 21];

function buildCogSelector() {
  const container = $("cogOptions");
  container.innerHTML = "";

  for (let cog = MIN_COG; cog <= MAX_COG; cog++) {
    const label = document.createElement("label");
    label.className = "cog-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = cog;
    checkbox.className = "cog-checkbox";
    checkbox.checked = defaultCogs.includes(cog);

    const text = document.createElement("span");
    text.textContent = `${cog}T`;

    label.append(checkbox, text);
    container.appendChild(label);

    checkbox.addEventListener("change", () => {
      updateCogSummary();
      update();
    });
  }

  updateCogSummary();
}

function getSelectedCogs() {
  return [...document.querySelectorAll(".cog-checkbox:checked")]
    .map(x => Number(x.value))
    .sort((a,b) => a-b);
}

function updateCogSummary() {
  const selected = getSelectedCogs();
  const summary = $("cogSummary");

  if (!selected.length) summary.textContent = "No rear cogs selected";
  else if (selected.length === MAX_COG - MIN_COG + 1) summary.textContent = "All cogs (7T–52T)";
  else if (selected.length <= 6) summary.textContent = selected.map(x => `${x}T`).join(", ");
  else summary.textContent = `${selected.length} cogs selected`;
}

$("selectAllCogs").addEventListener("click", () => {
  document.querySelectorAll(".cog-checkbox").forEach(x => x.checked = true);
  updateCogSummary();
  update();
});

$("clearCogs").addEventListener("click", () => {
  document.querySelectorAll(".cog-checkbox").forEach(x => x.checked = false);
  updateCogSummary();
  update();
});

function closeCogMenu() {
  $("cogDropdown").removeAttribute("open");
}

$("closeCogMenu").addEventListener("click", closeCogMenu);
$("doneCogs").addEventListener("click", closeCogMenu);

document.addEventListener("click", event => {
  const ringDropdown = $("ringDropdown");
  const cogDropdown = $("cogDropdown");

  if (
    ringDropdown.hasAttribute("open") &&
    !ringDropdown.contains(event.target)
  ) {
    closeRingMenu();
  }

  if (
    cogDropdown.hasAttribute("open") &&
    !cogDropdown.contains(event.target)
  ) {
    closeCogMenu();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeRingMenu();
    closeCogMenu();
  }
});

/*
 * Fast belt-style chain geometry.
 *
 * Treat the chainring and rear cog pitch circles as smooth pulleys. This is
 * the calculation CogSmith used before the discrete roller/polygon solver.
 * It keeps cog-selection changes responsive because it avoids building
 * polygons and sampling multiple rotational phases for every combination.
 */
function sprocketRadius(teeth) {
  return teeth / (4 * Math.PI);
}

const CHAIN_PITCH_IN = 0.5;
const CHAIN_PHASE_SAMPLES = 32;
const GEOMETRY_EPSILON = 1e-12;

/*
 * Standard-chain rounding changes at x.5 inches, while half-link rounding
 * changes at whole inches. The belt and polygon paths stayed within 0.007
 * inches across CogSmith's selectable tooth counts and 8–24 inch chainstays,
 * so a 0.01-inch window safely identifies every result that needs the more
 * exact rounding check.
 */
const ROUNDING_BOUNDARY_TOLERANCE_IN = 0.01;

function chainPath(chainring, cog, chainstay) {
  const ringRadius = sprocketRadius(chainring);
  const cogRadius = sprocketRadius(cog);
  const difference = ringRadius - cogRadius;

  if (Math.abs(difference) >= chainstay) return NaN;

  const thetaDegrees = Math.acos(difference / chainstay) * 180 / Math.PI;

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

function discreteChainPath(chainring, cog, chainstay) {
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

function chainGeometryForRounding(chainring, cog, chainstay) {
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

function solveChainstay(
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

function calculateCombinations() {
  const selectedRings = getSelectedRings();
  const selectedCogs = getSelectedCogs();
  const wheel = uiWheelToInches(Number($("wheel").value));
  const chainstayIn = uiChainstayToInches(Number($("chainstay").value));
  const target = Number($("target").value);
  const tolerance = Number($("tolerance").value);
  const dropoutTravelIn = uiDropoutToInches(Number($("dropout").value));

  const combinations = [];

  function addSolution(
    ring,
    cog,
    gearInches,
    chainLength,
    isHalfLink,
    pathCalculator
  ) {
    const requiredChainstayIn =
      solveChainstay(
        ring,
        cog,
        chainLength,
        chainstayIn,
        pathCalculator
      );

    const axleShiftIn =
      requiredChainstayIn - chainstayIn;

    const gearError =
      Math.abs(gearInches - target);

    const gearMatch =
      gearError <= tolerance;

    const dropoutMatch =
      Math.abs(axleShiftIn) <= dropoutTravelIn;

    const goldilocks =
      gearMatch && dropoutMatch;

    // Preserve the original ranking weight by expressing axle error in mm.
    // A tiny tie-break penalty keeps a standard chain ahead of an otherwise
    // identical half-link result.
    const score =
      gearError * 10 +
      Math.abs(axleShiftIn * IN_TO_MM) * 0.2 +
      (isHalfLink ? 0.001 : 0);

    combinations.push({
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
    });
  }

  for (const ring of selectedRings) {
    for (const cog of selectedCogs) {
      const gearInches =
        wheel * ring / cog;

      const chainGeometry =
        chainGeometryForRounding(ring, cog, chainstayIn);
      const theoreticalChain =
        chainGeometry.path;

      if (!Number.isFinite(theoreticalChain)) {
        continue;
      }

      /*
       * Standard chains:
       * usable lengths fall on whole-inch increments.
       */
      const standardChainLength =
        Math.round(theoreticalChain);

      addSolution(
        ring,
        cog,
        gearInches,
        standardChainLength,
        false,
        chainGeometry.pathCalculator
      );

      /*
       * Half-link option:
       * this is an ADDITIONAL possible chain length, always landing
       * on an x.5-inch length. It does not replace the standard point.
       */
      const halfLinkChainLength =
        Math.round(theoreticalChain - 0.5) + 0.5;

      addSolution(
        ring,
        cog,
        gearInches,
        halfLinkChainLength,
        true,
        chainGeometry.pathCalculator
      );
    }
  }

  return combinations;
}

function getStatus(item) {
  if (item.goldilocks) return "Goldilocks";
  if (item.gearMatch) return "Gear match";
  if (item.dropoutMatch) return "Fits dropout";
  return "Outside";
}

function getStatusPriority(item) {
  if (item.goldilocks) return 0;
  if (item.dropoutMatch) return 1;
  if (item.gearMatch) return 2;
  return 3;
}

function compareCombinations(a, b) {
  return (
    getStatusPriority(a) - getStatusPriority(b) ||
    a.gearError - b.gearError ||
    a.score - b.score
  );
}

function renderSummary(data) {
  const sorted = [...data].sort(compareCombinations);
  const best = sorted[0];

  if (!best) {
    $("bestCombo").textContent = "—";
    $("bestGear").textContent = "Select chainrings & cogs above to see results";
    $("bestShift").textContent = "—";
    $("bestChain").textContent = "—";
    $("goldCount").textContent = "0";
    return;
  }

  $("bestCombo").textContent = `${best.ring} × ${best.cog}`;
  $("bestGear").textContent =
    `${best.gearInches.toFixed(1)} gear inches · ${best.isHalfLink ? "Half-link" : "Standard chain"}`;

  $("bestShift").textContent =
    formatShift(best.axleShiftIn);

  $("bestChain").textContent =
    `${formatChainLength(best.chainLength)}${best.isHalfLink ? " · ½-link" : ""}`;
  $("goldCount").textContent = data.filter(x => x.goldilocks).length;
}

function renderTable(data) {
  const rows = [...data]
    .sort(compareCombinations)
    .slice(0,25);

  $("results").innerHTML = rows.map(item => {
    const badgeClass = item.goldilocks ? "gold" : item.dropoutMatch ? "fit" : "other";

    return `
      <tr>
        <td><strong>${item.ring} × ${item.cog}</strong></td>
        <td><span class="badge ${badgeClass}">${getStatus(item)}</span></td>
        <td>${item.gearInches.toFixed(1)}"</td>
        <td>${formatChainstay(item.requiredChainstayIn)}</td>
        <td>${formatShift(item.axleShiftIn)}</td>
        <td>
          ${formatChainLength(item.chainLength)}
          ${item.isHalfLink ? '<span class="badge half-link-badge">½-link</span>' : ''}
        </td>
      </tr>
    `;
  }).join("");
}

function renderChart(data) {
  const svg = d3.select("#chart");
  svg.selectAll("*").remove();

  if (!data.length) {
    activeChartZoom = null;
    activeChartSvg = null;
    return;
  }

  const showHalfLinks =
    $("halfLink").checked;

  const standardData =
    data.filter(d => !d.isHalfLink);

  const halfLinkData =
    data.filter(d => d.isHalfLink);

  /*
   * Both standard and half-link solutions participate in the base domain.
   * That keeps the underlying "whole picture" stable when half-link points
   * are shown or hidden.
   */
  const domainData =
    [...standardData, ...halfLinkData];

  const width = 1100;
  const height = 620;

  const margin = {
    top: 25,
    right: 35,
    bottom: 65,
    left: 75
  };

  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  svg.attr(
    "viewBox",
    `0 0 ${width} ${height}`
  );

  const measuredChainstayIn =
    uiChainstayToInches(
      Number($("chainstay").value)
    );

  const dropoutTravelIn =
    uiDropoutToInches(
      Number($("dropout").value)
    );

  const measuredChainstay =
    inchesToUiChainstay(
      measuredChainstayIn
    );

  const dropoutTravel =
    inchesToUiDropout(
      dropoutTravelIn
    );

  const target =
    Number($("target").value);

  const tolerance =
    Number($("tolerance").value);

  const xExtent =
    d3.extent(
      domainData,
      d => inchesToUiChainstay(
        d.requiredChainstayIn
      )
    );

  const yExtent =
    d3.extent(
      domainData,
      d => d.gearInches
    );

  const xPadding =
    Math.max(
      unitSystem === "metric" ? 5 : .2,
      (xExtent[1] - xExtent[0]) * .06
    );

  const x =
    d3.scaleLinear()
      .domain([
        Math.min(
          xExtent[0],
          measuredChainstay - dropoutTravel
        ) - xPadding,

        Math.max(
          xExtent[1],
          measuredChainstay + dropoutTravel
        ) + xPadding
      ])
      .range([
        plotLeft,
        plotRight
      ]);

  const y =
    d3.scaleLinear()
      .domain([
        Math.min(
          yExtent[0],
          target - tolerance
        ) - 5,

        Math.max(
          yExtent[1],
          target + tolerance
        ) + 5
      ])
      .nice()
      .range([
        plotBottom,
        plotTop
      ]);

  /*
   * Clip everything inside the plotting area while zooming/panning so dots
   * and shaded bands never draw over the axes or labels.
   */
  svg.append("defs")
    .append("clipPath")
    .attr("id", "plotClip")
    .append("rect")
    .attr("x", plotLeft)
    .attr("y", plotTop)
    .attr("width", plotWidth)
    .attr("height", plotHeight);

  const plot =
    svg.append("g")
      .attr(
        "clip-path",
        "url(#plotClip)"
      );

  const xGrid =
    plot.append("g")
      .attr("class", "grid")
      .attr(
        "transform",
        `translate(0,${plotBottom})`
      );

  const yGrid =
    plot.append("g")
      .attr("class", "grid")
      .attr(
        "transform",
        `translate(${plotLeft},0)`
      );

  const dropoutBand =
    plot.append("rect")
      .attr(
        "fill",
        "var(--goodSoft)"
      )
      .attr(
        "opacity",
        .68
      );

  const targetBand =
    plot.append("rect")
      .attr(
        "fill",
        "var(--accentSoft)"
      )
      .attr(
        "opacity",
        .68
      );

  const measuredChainstayLine =
    plot.append("line")
      .attr(
        "stroke",
        "var(--good)"
      )
      .attr(
        "stroke-width",
        2
      )
      .attr(
        "stroke-dasharray",
        "6 5"
      );

  const targetLine =
    plot.append("line")
      .attr(
        "stroke",
        "var(--accent)"
      )
      .attr(
        "stroke-width",
        2
      )
      .attr(
        "stroke-dasharray",
        "6 5"
      );

  const xAxis =
    svg.append("g")
      .attr("class", "axis")
      .attr(
        "transform",
        `translate(0,${plotBottom})`
      );

  const yAxis =
    svg.append("g")
      .attr("class", "axis")
      .attr(
        "transform",
        `translate(${plotLeft},0)`
      );

  svg.append("text")
    .attr(
      "x",
      (plotLeft + plotRight) / 2
    )
    .attr(
      "y",
      height - 15
    )
    .attr(
      "text-anchor",
      "middle"
    )
    .attr(
      "fill",
      "var(--text)"
    )
    .text(
      unitSystem === "metric"
        ? "Required chainstay length (mm)"
        : "Required chainstay length (in)"
    );

  svg.append("text")
    .attr(
      "transform",
      "rotate(-90)"
    )
    .attr(
      "x",
      -(plotTop + plotBottom) / 2
    )
    .attr(
      "y",
      20
    )
    .attr(
      "text-anchor",
      "middle"
    )
    .attr(
      "fill",
      "var(--text)"
    )
    .text(
      "Gear inches"
    );

  const tooltip =
    d3.select("#tooltip");

  function attachTooltip(
    groups,
    restingRadius
  ) {
    groups
      .on(
        "mouseenter",
        function(event, d) {
          d3.select(this)
            .select("circle")
            .attr(
              "r",
              d.goldilocks ? 8 : 7
            );

          tooltip
            .style(
              "display",
              "block"
            )
            .html(`
              <strong>${d.ring} × ${d.cog}</strong><br>
              ${d.gearInches.toFixed(1)} gear inches<br>
              ${formatChainstay(d.requiredChainstayIn)} chainstay<br>
              ${formatShift(d.axleShiftIn)} axle shift<br>
              ${formatChainLength(d.chainLength)} chain<br>
              <strong class="${d.isHalfLink ? "half-link-text" : ""}">
                ${d.isHalfLink ? "Half-link option" : "Standard chain"}
              </strong><br>
              ${getStatus(d)}
            `);
        }
      )
      .on(
        "mousemove",
        function(event) {
          const r =
            $("chart-container")
              .getBoundingClientRect();

          tooltip
            .style(
              "left",
              `${event.clientX - r.left + 14}px`
            )
            .style(
              "top",
              `${event.clientY - r.top + 14}px`
            );
        }
      )
      .on(
        "mouseleave",
        function(event, d) {
          d3.select(this)
            .select("circle")
            .attr(
              "r",
              restingRadius(d)
            );

          tooltip.style(
            "display",
            "none"
          );
        }
      );
  }

  /*
   * STANDARD CHAIN POINTS
   */
  const standardGroups =
    plot.append("g")
      .attr(
        "aria-label",
        "Standard chain options"
      )
      .selectAll("g")
      .data(standardData)
      .join("g");

  standardGroups
    .append("circle")
    .attr(
      "r",
      d => d.goldilocks ? 6 : 3.5
    )
    .attr(
      "fill",
      d => d.goldilocks
        ? "var(--accent)"
        : "var(--point)"
    )
    .attr(
      "opacity",
      d => d.goldilocks
        ? 1
        : (
            d.gearMatch ||
            d.dropoutMatch
              ? .8
              : .35
          )
    );

  standardGroups
    .filter(d => d.goldilocks)
    .append("text")
    .attr(
      "class",
      "combo-label"
    )
    .attr("x", 8)
    .attr("y", -7)
    .text(
      d => `${d.ring}×${d.cog}`
    );

  attachTooltip(
    standardGroups,
    d => d.goldilocks ? 6 : 3.5
  );

  /*
   * HALF-LINK OVERLAY
   */
  let halfGroups = null;

  if (showHalfLinks) {
    halfGroups =
      plot.append("g")
        .attr(
          "aria-label",
          "Half-link options"
        )
        .selectAll("g")
        .data(halfLinkData)
        .join("g");

    halfGroups
      .append("circle")
      .attr(
        "r",
        d => d.goldilocks ? 6 : 4.3
      )
      .attr(
        "fill",
        d => d.goldilocks
          ? "var(--halfLinkSoft)"
          : "var(--panel)"
      )
      .attr(
        "stroke",
        "var(--halfLink)"
      )
      .attr(
        "stroke-width",
        d => d.goldilocks ? 2.5 : 1.6
      )
      .attr(
        "opacity",
        d => d.goldilocks
          ? 1
          : (
              d.gearMatch ||
              d.dropoutMatch
                ? .9
                : .55
            )
      );

    halfGroups
      .filter(d => d.goldilocks)
      .append("text")
      .attr(
        "class",
        "combo-label half-link-label"
      )
      .attr("x", 8)
      .attr("y", 12)
      .text(
        d => `${d.ring}×${d.cog} ½`
      );

    attachTooltip(
      halfGroups,
      d => d.goldilocks ? 6 : 4.3
    );
  }

  const xTickFormat =
    unitSystem === "metric"
      ? d3.format(".1f")
      : d3.format(".3f");

  /*
   * Redraw every screen-position-dependent element from transformed scales.
   * Circle radii and label sizes stay constant, making the chart readable
   * even at high zoom levels.
   */
  function redraw(transform) {
    const zx =
      transform.rescaleX(x);

    const zy =
      transform.rescaleY(y);

    xGrid.call(
      d3.axisBottom(zx)
        .ticks(10)
        .tickSize(-plotHeight)
        .tickFormat("")
    );

    yGrid.call(
      d3.axisLeft(zy)
        .ticks(10)
        .tickSize(-plotWidth)
        .tickFormat("")
    );

    xAxis.call(
      d3.axisBottom(zx)
        .ticks(10)
        .tickFormat(xTickFormat)
    );

    yAxis.call(
      d3.axisLeft(zy)
        .ticks(10)
    );

    dropoutBand
      .attr(
        "x",
        zx(
          measuredChainstay -
          dropoutTravel
        )
      )
      .attr(
        "y",
        plotTop
      )
      .attr(
        "width",
        Math.max(
          0,
          zx(
            measuredChainstay +
            dropoutTravel
          ) -
          zx(
            measuredChainstay -
            dropoutTravel
          )
        )
      )
      .attr(
        "height",
        plotHeight
      );

    targetBand
      .attr(
        "x",
        plotLeft
      )
      .attr(
        "y",
        zy(
          target +
          tolerance
        )
      )
      .attr(
        "width",
        plotWidth
      )
      .attr(
        "height",
        Math.max(
          0,
          zy(
            target -
            tolerance
          ) -
          zy(
            target +
            tolerance
          )
        )
      );

    measuredChainstayLine
      .attr(
        "x1",
        zx(measuredChainstay)
      )
      .attr(
        "x2",
        zx(measuredChainstay)
      )
      .attr(
        "y1",
        plotTop
      )
      .attr(
        "y2",
        plotBottom
      );

    targetLine
      .attr(
        "x1",
        plotLeft
      )
      .attr(
        "x2",
        plotRight
      )
      .attr(
        "y1",
        zy(target)
      )
      .attr(
        "y2",
        zy(target)
      );

    standardGroups
      .attr(
        "transform",
        d => `translate(
          ${zx(
            inchesToUiChainstay(
              d.requiredChainstayIn
            )
          )},
          ${zy(d.gearInches)}
        )`
      );

    if (halfGroups) {
      halfGroups
        .attr(
          "transform",
          d => `translate(
            ${zx(
              inchesToUiChainstay(
                d.requiredChainstayIn
              )
            )},
            ${zy(d.gearInches)}
          )`
        );
    }
  }

  const zoom =
    d3.zoom()
      .scaleExtent([
        1,
        20
      ])
      .extent([
        [plotLeft, plotTop],
        [plotRight, plotBottom]
      ])
      .translateExtent([
        [plotLeft, plotTop],
        [plotRight, plotBottom]
      ])
      .filter(event => {
        if (
          event.type === "mousedown"
        ) {
          return event.button === 0;
        }

        return true;
      })
      .on(
        "zoom",
        event => {
          chartZoomTransform =
            event.transform;

          tooltip.style(
            "display",
            "none"
          );

          redraw(
            chartZoomTransform
          );
        }
      );

  activeChartZoom =
    zoom;

  activeChartSvg =
    svg;

  svg.call(
    zoom
  );

  // Double-click is kept free from D3's default zoom so the dedicated
  // controls remain predictable.
  svg.on(
    "dblclick.zoom",
    null
  );

  /*
   * Restore the current view after a redraw. This is especially useful when
   * enabling the half-link overlay while already zoomed into a promising
   * cluster.
   */
  svg.call(
    zoom.transform,
    chartZoomTransform
  );

  $("halfLinkLegend").style.display =
    showHalfLinks
      ? "inline-flex"
      : "none";
}


function formatToothSelection(values) {
  if (!values.length) {
    return "None";
  }

  const parts = [];
  let start = values[0];
  let previous = values[0];

  function pushRange(a, b) {
    if (a === b) {
      parts.push(`${a}T`);
    } else if (b === a + 1) {
      parts.push(`${a}T, ${b}T`);
    } else {
      parts.push(`${a}T-${b}T`);
    }
  }

  for (let i = 1; i < values.length; i++) {
    const value = values[i];

    if (value === previous + 1) {
      previous = value;
      continue;
    }

    pushRange(start, previous);
    start = value;
    previous = value;
  }

  pushRange(start, previous);
  return parts.join(", ");
}

function pdfChainstayValue(inches) {
  return unitSystem === "metric"
    ? `${(inches * IN_TO_MM).toFixed(1)} mm`
    : `${inches.toFixed(3)} in`;
}

function pdfShiftValue(inches) {
  const sign = inches >= 0 ? "+" : "-";
  const absolute = Math.abs(inches);

  return unitSystem === "metric"
    ? `${sign}${(absolute * IN_TO_MM).toFixed(1)} mm`
    : `${sign}${absolute.toFixed(3)} in`;
}

function pdfChainLengthValue(inches) {
  return unitSystem === "metric"
    ? `${(inches * IN_TO_CM).toFixed(1)} cm`
    : `${Number.isInteger(inches) ? inches.toFixed(0) : inches.toFixed(1)} in`;
}

function setPdfTextColor(doc, type = "text") {
  if (type === "muted") {
    doc.setTextColor(90, 98, 112);
  } else if (type === "accent") {
    doc.setTextColor(91, 53, 170);
  } else if (type === "gold") {
    doc.setTextColor(145, 99, 0);
  } else if (type === "green") {
    doc.setTextColor(20, 115, 72);
  } else {
    doc.setTextColor(30, 38, 52);
  }
}

function pdfSectionTitle(doc, title, y) {
  setPdfTextColor(doc, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 14, y);
  doc.setDrawColor(220, 223, 230);
  doc.line(14, y + 2, 196, y + 2);
  return y + 8;
}

function pdfKeyValue(doc, label, value, x, y, width = 84) {
  setPdfTextColor(doc, "muted");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(label, x, y);

  setPdfTextColor(doc, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);

  const lines = doc.splitTextToSize(String(value), width);
  doc.text(lines, x, y + 4);

  return y + 4 + lines.length * 4;
}

async function chartToPngDataUrl() {
  const sourceSvg = $("chart");

  if (!sourceSvg || !sourceSvg.children.length) {
    return null;
  }

  const clone = sourceSvg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "1100");
  clone.setAttribute("height", "620");

  const sourceNodes = [
    sourceSvg,
    ...sourceSvg.querySelectorAll("*")
  ];

  const cloneNodes = [
    clone,
    ...clone.querySelectorAll("*")
  ];

  sourceNodes.forEach((node, index) => {
    const cloneNode = cloneNodes[index];

    if (!cloneNode) {
      return;
    }

    const style = getComputedStyle(node);

    [
      "fill",
      "stroke",
      "color",
      "opacity",
      "font-family",
      "font-size",
      "font-weight"
    ].forEach(property => {
      const value = style.getPropertyValue(property);

      if (value) {
        cloneNode.style.setProperty(property, value);
      }
    });
  });

  const serializer =
    new XMLSerializer();

  const svgText =
    serializer.serializeToString(clone);

  const blob =
    new Blob(
      [svgText],
      { type: "image/svg+xml;charset=utf-8" }
    );

  const objectUrl =
    URL.createObjectURL(blob);

  try {
    const image =
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });

    const canvas =
      document.createElement("canvas");

    canvas.width = 1650;
    canvas.height = 930;

    const context =
      canvas.getContext("2d");

    context.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--panel")
        .trim() || "#ffffff";

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas.toDataURL(
      "image/png",
      0.92
    );
  } finally {
    URL.revokeObjectURL(
      objectUrl
    );
  }
}

async function generatePdfReport() {
  const button =
    $("generatePdf");

  const oldText =
    button.innerHTML;

  button.disabled = true;
  button.textContent = "Generating PDF...";

  try {
    if (
      !window.jspdf ||
      !window.jspdf.jsPDF
    ) {
      throw new Error(
        "The PDF library did not load."
      );
    }

    const {
      jsPDF
    } = window.jspdf;

    const allData =
      calculateCombinations();

    const visibleData =
      $("halfLink").checked
        ? allData
        : allData.filter(
            d => !d.isHalfLink
          );

    const ranked =
      [...visibleData].sort(
        compareCombinations
      );

    const best =
      ranked[0];

    const goldilocks =
      ranked.filter(
        d => d.goldilocks
      );

    const selectedRings =
      getSelectedRings();

    const selectedCogs =
      getSelectedCogs();

    const wheelIn =
      uiWheelToInches(
        Number($("wheel").value)
      );

    const chainstayIn =
      uiChainstayToInches(
        Number($("chainstay").value)
      );

    const dropoutIn =
      uiDropoutToInches(
        Number($("dropout").value)
      );

    const target =
      Number($("target").value);

    const tolerance =
      Number($("tolerance").value);

    const doc =
      new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

    // ---------------------------
    // Page 1: setup and results
    // ---------------------------
    setPdfTextColor(doc, "accent");
    doc.setFont(
      "helvetica",
      "bold"
    );
    doc.setFontSize(22);
    doc.text(
      "CogSmith",
      14,
      18
    );

    setPdfTextColor(doc, "muted");
    doc.setFont(
      "helvetica",
      "normal"
    );
    doc.setFontSize(9);
    doc.text(
      "Single-speed gearing report",
      14,
      24
    );

    const generated =
      new Date()
        .toLocaleString();

    doc.text(
      `Generated ${generated}`,
      196,
      18,
      { align: "right" }
    );

    let y = 34;

    y = pdfSectionTitle(
      doc,
      "Bike setup",
      y
    );

    const unitLabel =
      unitSystem === "metric"
        ? "Metric"
        : "Imperial";

    const wheelValue =
      unitSystem === "metric"
        ? `${(wheelIn * IN_TO_MM).toFixed(1)} mm`
        : `${wheelIn.toFixed(2)} in`;

    const dropoutValue =
      unitSystem === "metric"
        ? `+/- ${(dropoutIn * IN_TO_MM).toFixed(1)} mm`
        : `+/- ${dropoutIn.toFixed(3)} in`;

    pdfKeyValue(
      doc,
      "Units",
      unitLabel,
      14,
      y
    );

    pdfKeyValue(
      doc,
      "Wheel diameter",
      wheelValue,
      60,
      y
    );

    pdfKeyValue(
      doc,
      "Chainstay",
      pdfChainstayValue(
        chainstayIn
      ),
      106,
      y
    );

    pdfKeyValue(
      doc,
      "Dropout travel",
      dropoutValue,
      152,
      y,
      44
    );

    y += 14;

    const ringLines =
      doc.splitTextToSize(
        formatToothSelection(
          selectedRings
        ),
        82
      );

    const cogLines =
      doc.splitTextToSize(
        formatToothSelection(
          selectedCogs
        ),
        82
      );

    setPdfTextColor(doc, "muted");
    doc.setFont(
      "helvetica",
      "normal"
    );
    doc.setFontSize(8.5);
    doc.text(
      "Selected chainrings",
      14,
      y
    );
    doc.text(
      "Selected rear cogs",
      106,
      y
    );

    setPdfTextColor(doc, "text");
    doc.setFont(
      "helvetica",
      "bold"
    );
    doc.setFontSize(9);
    doc.text(
      ringLines,
      14,
      y + 4
    );
    doc.text(
      cogLines,
      106,
      y + 4
    );

    y +=
      7 +
      Math.max(
        ringLines.length,
        cogLines.length
      ) * 4;

    pdfKeyValue(
      doc,
      "Target gear inches",
      target.toFixed(1),
      14,
      y
    );

    pdfKeyValue(
      doc,
      "Gear tolerance",
      `+/- ${tolerance.toFixed(1)}`,
      60,
      y
    );

    pdfKeyValue(
      doc,
      "Half-link options",
      $("halfLink").checked
        ? "Included"
        : "Not included",
      106,
      y
    );

    pdfKeyValue(
      doc,
      "Combinations tested",
      String(
        visibleData.length
      ),
      152,
      y
    );

    y += 18;

    y = pdfSectionTitle(
      doc,
      "Best match",
      y
    );

    if (best) {
      setPdfTextColor(
        doc,
        best.isHalfLink
          ? "gold"
          : "accent"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );
      doc.setFontSize(18);
      doc.text(
        `${best.ring} x ${best.cog}`,
        14,
        y + 3
      );

      setPdfTextColor(
        doc,
        "text"
      );
      doc.setFontSize(10);
      doc.text(
        `${best.gearInches.toFixed(1)} gear inches`,
        48,
        y + 3
      );

      doc.setFontSize(9);
      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        [
          `Required chainstay: ${pdfChainstayValue(best.requiredChainstayIn)}`,
          `Axle shift: ${pdfShiftValue(best.axleShiftIn)}`,
          `Chain length: ${pdfChainLengthValue(best.chainLength)}`,
          `Chain type: ${best.isHalfLink ? "Half-link" : "Standard"}`,
          `Status: ${getStatus(best)}`
        ],
        14,
        y + 10
      );

      setPdfTextColor(
        doc,
        "green"
      );
      doc.setFont(
        "helvetica",
        "bold"
      );
      doc.setFontSize(10);
      doc.text(
        `${goldilocks.length} Goldilocks combination${goldilocks.length === 1 ? "" : "s"} found`,
        196,
        y + 3,
        { align: "right" }
      );
    } else {
      setPdfTextColor(
        doc,
        "muted"
      );
      doc.setFontSize(10);
      doc.text(
        "No combinations are currently selected.",
        14,
        y + 3
      );
    }

    y += 36;

    y = pdfSectionTitle(
      doc,
      "Best combinations",
      y
    );

    const rows =
      ranked.slice(
        0,
        15
      );

    const columns = [
      { label: "Setup", x: 14 },
      { label: "GI", x: 39 },
      { label: "Chainstay", x: 57 },
      { label: "Axle shift", x: 94 },
      { label: "Chain", x: 126 },
      { label: "Type", x: 151 },
      { label: "Status", x: 174 }
    ];

    doc.setFillColor(
      241,
      243,
      247
    );
    doc.rect(
      14,
      y - 4,
      182,
      7,
      "F"
    );

    setPdfTextColor(
      doc,
      "muted"
    );
    doc.setFont(
      "helvetica",
      "bold"
    );
    doc.setFontSize(7.8);

    columns.forEach(
      column => {
        doc.text(
          column.label,
          column.x,
          y
        );
      }
    );

    y += 6;

    doc.setFontSize(7.4);

    rows.forEach(
      (item, index) => {
        if (
          index % 2 === 1
        ) {
          doc.setFillColor(
            249,
            250,
            252
          );
          doc.rect(
            14,
            y - 3.5,
            182,
            6,
            "F"
          );
        }

        setPdfTextColor(
          doc,
          "text"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          `${item.ring} x ${item.cog}`,
          14,
          y
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.text(
          item.gearInches.toFixed(1),
          39,
          y
        );

        doc.text(
          pdfChainstayValue(
            item.requiredChainstayIn
          ),
          57,
          y
        );

        doc.text(
          pdfShiftValue(
            item.axleShiftIn
          ),
          94,
          y
        );

        doc.text(
          pdfChainLengthValue(
            item.chainLength
          ),
          126,
          y
        );

        if (
          item.isHalfLink
        ) {
          setPdfTextColor(
            doc,
            "gold"
          );
        }

        doc.text(
          item.isHalfLink
            ? "Half-link"
            : "Standard",
          151,
          y
        );

        setPdfTextColor(
          doc,
          item.goldilocks
            ? "green"
            : "text"
        );

        doc.text(
          getStatus(item),
          174,
          y
        );

        y += 6;
      }
    );

    setPdfTextColor(
      doc,
      "muted"
    );
    doc.setFont(
      "helvetica",
      "normal"
    );
    doc.setFontSize(7.5);
    doc.text(
      "Goldilocks matches satisfy both the target gear-inch tolerance and the available dropout travel.",
      14,
      286
    );

    // ---------------------------
    // Page 2: chart
    // ---------------------------
    try {
      const chartImage =
        await chartToPngDataUrl();

      if (chartImage) {
        doc.addPage(
          "a4",
          "landscape"
        );

        setPdfTextColor(
          doc,
          "text"
        );
        doc.setFont(
          "helvetica",
          "bold"
        );
        doc.setFontSize(15);
        doc.text(
          "Magic gear map",
          14,
          15
        );

        setPdfTextColor(
          doc,
          "muted"
        );
        doc.setFont(
          "helvetica",
          "normal"
        );
        doc.setFontSize(8);
        doc.text(
          "The chart reflects the current zoom and half-link overlay state.",
          14,
          20
        );

        doc.addImage(
          chartImage,
          "PNG",
          14,
          26,
          269,
          151
        );
      }
    } catch (chartError) {
      console.warn(
        "Could not add chart image to PDF:",
        chartError
      );
    }

    // Add page numbers.
    const pageCount =
      doc.getNumberOfPages();

    for (
      let page = 1;
      page <= pageCount;
      page++
    ) {
      doc.setPage(page);

      setPdfTextColor(
        doc,
        "muted"
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7);

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      doc.text(
        `CogSmith - Page ${page} of ${pageCount}`,
        pageWidth - 14,
        pageHeight - 7,
        { align: "right" }
      );
    }

    const dateStamp =
      new Date()
        .toISOString()
        .slice(0, 10);

    doc.save(
      `cogsmith-report-${dateStamp}.pdf`
    );
  } catch (error) {
    console.error(
      "PDF generation failed:",
      error
    );

    alert(
      "The PDF report could not be generated. Check that the page is online so the PDF library can load, then try again."
    );
  } finally {
    button.disabled = false;
    button.innerHTML = oldText;
  }
}

function update() {
  const allData =
    calculateCombinations();

  const visibleData =
    $("halfLink").checked
      ? allData
      : allData.filter(
          d => !d.isHalfLink
        );

  renderSummary(
    visibleData
  );

  renderChart(
    allData
  );

  renderTable(
    visibleData
  );
}

["wheel","chainstay","dropout","target","tolerance","halfLink"].forEach(id => {
  $(id).addEventListener("input", update);
  $(id).addEventListener("change", update);
});

$("metricUnits").addEventListener("click", () => setUnitSystem("metric"));
$("imperialUnits").addEventListener("click", () => setUnitSystem("imperial"));

function chartZoomBy(factor) {
  if (
    !activeChartZoom ||
    !activeChartSvg
  ) {
    return;
  }

  activeChartSvg
    .transition()
    .duration(180)
    .call(
      activeChartZoom.scaleBy,
      factor
    );
}

$("zoomIn").addEventListener(
  "click",
  () => chartZoomBy(1.5)
);

$("zoomOut").addEventListener(
  "click",
  () => chartZoomBy(1 / 1.5)
);

$("generatePdf").addEventListener(
  "click",
  generatePdfReport
);

$("zoomReset").addEventListener(
  "click",
  () => {
    if (
      !activeChartZoom ||
      !activeChartSvg
    ) {
      return;
    }

    chartZoomTransform =
      d3.zoomIdentity;

    activeChartSvg
      .transition()
      .duration(220)
      .call(
        activeChartZoom.transform,
        d3.zoomIdentity
      );
  }
);

buildRingSelector();
buildCogSelector();
update();
