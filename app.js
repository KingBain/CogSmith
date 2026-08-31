import {
  calculateCombinations as calculateGearingCombinations,
  compareCombinations,
  getStatus
} from "./src/core/calculator.js";

const $ = id => document.getElementById(id);

let unitSystem = "metric";

const IN_TO_MM = 25.4;
const IN_TO_CM = 2.54;

// Keep the current chart view when the calculator redraws, such as when
// half-link points are toggled on or off.
let chartZoomTransform = d3.zoomIdentity;
let activeChartZoom = null;
let activeChartSvg = null;
let selectedChartKey = null;
let lastChartLayoutKey = null;
let chartExpanded = false;

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

    if (chartExpanded) {
      setChartExpanded(false);
    }
  }
});
function calculateCombinations() {
  return calculateGearingCombinations({
    rings: getSelectedRings(),
    cogs: getSelectedCogs(),
    wheelDiameterIn: uiWheelToInches(Number($("wheel").value)),
    chainstayIn: uiChainstayToInches(Number($("chainstay").value)),
    targetGearInches: Number($("target").value),
    gearTolerance: Number($("tolerance").value),
    dropoutTravelIn: uiDropoutToInches(Number($("dropout").value))
  });
}

function getChartLayout({ forceDesktop = false } = {}) {
  const desktopLayout = {
    key: "desktop",
    width: 1100,
    height: 620,
    margin: {
      top: 25,
      right: 35,
      bottom: 65,
      left: 75
    },
    tickCount: 10,
    tickFontSize: 10,
    axisTitleFontSize: 16,
    yAxisTitleOffset: 20,
    labelFontSize: 10,
    goldRadius: 6,
    standardRadius: 3.5,
    standardRelevantRadius: 3.5,
    halfRadius: 4.3,
    halfRelevantRadius: 4.3,
    hoverRadius: 7,
    hitRadius: 12,
    selectionPadding: 4,
    labelX: 8,
    standardLabelY: -7,
    halfLabelY: 12
  };

  if (forceDesktop) {
    return {
      ...desktopLayout,
      key: "desktop-export"
    };
  }

  const standalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches;

  const compactViewport =
    window.matchMedia(
      "(max-width: 640px)"
    ).matches ||
    (
      standalone &&
      window.innerWidth <= 900
    );

  const portrait =
    window.innerHeight >=
    window.innerWidth;

  if (
    chartExpanded &&
    !portrait
  ) {
    return {
      ...desktopLayout,
      key: "expanded-landscape",
      tickCount: 7,
      tickFontSize: 14,
      axisTitleFontSize: 18,
      yAxisTitleOffset: 24,
      labelFontSize: 13,
      goldRadius: 8,
      standardRadius: 4.5,
      standardRelevantRadius: 6,
      halfRadius: 5,
      halfRelevantRadius: 6.5,
      hoverRadius: 10,
      hitRadius: 18,
      selectionPadding: 5,
      labelX: 11,
      standardLabelY: -9,
      halfLabelY: 16
    };
  }

  if (
    chartExpanded ||
    compactViewport
  ) {
    return {
      key: chartExpanded
        ? "expanded-portrait"
        : "mobile",
      width: chartExpanded
        ? 680
        : 640,
      height: chartExpanded
        ? 820
        : 720,
      margin: {
        top: 30,
        right: 24,
        bottom: 82,
        left: 84
      },
      tickCount: 4,
      tickFontSize: 22,
      axisTitleFontSize: 24,
      yAxisTitleOffset: 28,
      labelFontSize: 19,
      goldRadius: 10,
      standardRadius: 5,
      standardRelevantRadius: 7,
      halfRadius: 5.5,
      halfRelevantRadius: 7.5,
      hoverRadius: 12,
      hitRadius: 26,
      selectionPadding: 5,
      labelX: 13,
      standardLabelY: -12,
      halfLabelY: 18
    };
  }

  return desktopLayout;
}

function chartItemKey(item) {
  return [
    item.ring,
    item.cog,
    item.isHalfLink
      ? "half"
      : "standard"
  ].join(":");
}

function chartStatusToken(item) {
  if (item.goldilocks) {
    return "goldilocks";
  }

  if (item.dropoutMatch) {
    return "fits-dropout";
  }

  if (item.gearMatch) {
    return "gear-match";
  }

  return "outside";
}

function updateChartSelection(item) {
  const selection =
    $("chartSelection");

  selectedChartKey =
    chartItemKey(item);

  $("chartSelectionSetup").textContent =
    `${item.ring} × ${item.cog}`;

  const status =
    $("chartSelectionStatus");

  status.textContent =
    getStatus(item);

  status.dataset.status =
    chartStatusToken(item);

  $("chartSelectionGear").textContent =
    item.gearInches.toFixed(1);

  $("chartSelectionChainstay").textContent =
    formatChainstay(
      item.requiredChainstayIn
    );

  $("chartSelectionShift").textContent =
    formatShift(
      item.axleShiftIn
    );

  $("chartSelectionChain").textContent =
    formatChainLength(
      item.chainLength
    );

  $("chartSelectionType").textContent =
    item.isHalfLink
      ? "Half-link"
      : "Standard";

  selection.hidden = false;
}

function clearChartSelection() {
  selectedChartKey = null;
  $("chartSelection").hidden = true;

  d3.select("#chart")
    .selectAll(
      ".chart-point-group"
    )
    .classed(
      "is-selected",
      false
    );
}

function selectChartItem(item) {
  updateChartSelection(item);

  d3.select("#chart")
    .selectAll(
      ".chart-point-group"
    )
    .classed(
      "is-selected",
      d => chartItemKey(d) ===
        selectedChartKey
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

function renderChart(
  data,
  options = {}
) {
  const svg = d3.select("#chart");
  svg.selectAll("*").remove();

  const layout =
    getChartLayout(options);

  lastChartLayoutKey =
    layout.key;

  svg
    .attr(
      "data-chart-layout",
      layout.key
    )
    .style(
      "--chart-tick-size",
      `${layout.tickFontSize}px`
    )
    .style(
      "--chart-axis-title-size",
      `${layout.axisTitleFontSize}px`
    )
    .style(
      "--chart-label-size",
      `${layout.labelFontSize}px`
    );

  if (!data.length) {
    activeChartZoom = null;
    activeChartSvg = null;
    clearChartSelection();
    $("halfLinkLegend").style.display =
      "none";
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

  const {
    width,
    height,
    margin
  } = layout;

  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  svg.attr(
    "viewBox",
    `0 0 ${width} ${height}`
  )
    .attr(
      "preserveAspectRatio",
      "xMidYMid meet"
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
      "class",
      "chart-axis-title"
    )
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
      "class",
      "chart-axis-title"
    )
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
      layout.yAxisTitleOffset
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

  function standardPointRadius(item) {
    if (item.goldilocks) {
      return layout.goldRadius;
    }

    return (
      item.gearMatch ||
      item.dropoutMatch
    )
      ? layout.standardRelevantRadius
      : layout.standardRadius;
  }

  function halfLinkPointRadius(item) {
    if (item.goldilocks) {
      return layout.goldRadius;
    }

    return (
      item.gearMatch ||
      item.dropoutMatch
    )
      ? layout.halfRelevantRadius
      : layout.halfRadius;
  }

  function attachPointInteractions(
    groups,
    restingRadius
  ) {
    groups
      .on(
        "click",
        function(event, item) {
          event.stopPropagation();
          selectChartItem(item);
        }
      );

    const supportsHover =
      window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      ).matches;

    if (!supportsHover) {
      return;
    }

    groups
      .on(
        "mouseenter",
        function(event, d) {
          d3.select(this)
            .select(
              ".chart-point"
            )
            .attr(
              "r",
              Math.max(
                layout.hoverRadius,
                restingRadius(d) + 2
              )
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
            .select(
              ".chart-point"
            )
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
      .join("g")
      .attr(
        "class",
        "chart-point-group"
      );

  standardGroups
    .append("circle")
    .attr(
      "class",
      "chart-point"
    )
    .attr(
      "r",
      standardPointRadius
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
    .append("circle")
    .attr(
      "class",
      "chart-selection-ring"
    )
    .attr(
      "r",
      d => standardPointRadius(d) +
        layout.selectionPadding
    );

  standardGroups
    .filter(d => d.goldilocks)
    .append("text")
    .attr(
      "class",
      "combo-label"
    )
    .attr(
      "x",
      layout.labelX
    )
    .attr(
      "y",
      layout.standardLabelY
    )
    .text(
      d => `${d.ring}×${d.cog}`
    );

  standardGroups
    .append("circle")
    .attr(
      "class",
      "chart-hit-target"
    )
    .attr(
      "r",
      layout.hitRadius
    );

  attachPointInteractions(
    standardGroups,
    standardPointRadius
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
        .join("g")
        .attr(
          "class",
          "chart-point-group"
        );

    halfGroups
      .append("circle")
      .attr(
        "class",
        "chart-point"
      )
      .attr(
        "r",
        halfLinkPointRadius
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
      .append("circle")
      .attr(
        "class",
        "chart-selection-ring"
      )
      .attr(
        "r",
        d => halfLinkPointRadius(d) +
          layout.selectionPadding
      );

    halfGroups
      .filter(d => d.goldilocks)
      .append("text")
      .attr(
        "class",
        "combo-label half-link-label"
      )
      .attr(
        "x",
        layout.labelX
      )
      .attr(
        "y",
        layout.halfLabelY
      )
      .text(
        d => `${d.ring}×${d.cog} ½`
      );

    halfGroups
      .append("circle")
      .attr(
        "class",
        "chart-hit-target"
      )
      .attr(
        "r",
        layout.hitRadius
      );

    attachPointInteractions(
      halfGroups,
      halfLinkPointRadius
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
        .ticks(
          layout.tickCount
        )
        .tickSize(-plotHeight)
        .tickFormat("")
    );

    yGrid.call(
      d3.axisLeft(zy)
        .ticks(
          layout.tickCount
        )
        .tickSize(-plotWidth)
        .tickFormat("")
    );

    xAxis.call(
      d3.axisBottom(zx)
        .ticks(
          layout.tickCount
        )
        .tickFormat(xTickFormat)
    );

    yAxis.call(
      d3.axisLeft(zy)
        .ticks(
          layout.tickCount
        )
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

  if (selectedChartKey) {
    const selectedItem =
      (
        showHalfLinks
          ? domainData
          : standardData
      ).find(
        item => chartItemKey(item) ===
          selectedChartKey
      );

    if (selectedItem) {
      updateChartSelection(
        selectedItem
      );

      svg.selectAll(
        ".chart-point-group"
      )
        .classed(
          "is-selected",
          item => chartItemKey(item) ===
            selectedChartKey
        );
    } else {
      clearChartSelection();
    }
  }

  $("halfLinkLegend").style.display =
    showHalfLinks
      ? "inline-flex"
      : "none";
}

function setChartExpanded(next) {
  chartExpanded =
    Boolean(next);

  const chartPanel =
    $("chartPanel");

  chartPanel.classList.toggle(
    "is-expanded",
    chartExpanded
  );

  if (chartExpanded) {
    chartPanel.scrollTop = 0;
  }

  document.body.classList.toggle(
    "chart-expanded",
    chartExpanded
  );

  $("expandChart").setAttribute(
    "aria-expanded",
    String(chartExpanded)
  );

  $("expandChartLabel").textContent =
    chartExpanded
      ? "Close graph"
      : "Expand graph";

  $("tooltip").style.display =
    "none";

  renderChart(
    calculateCombinations()
  );

  window.requestAnimationFrame(
    () => $("expandChart").focus({
      preventScroll: true
    })
  );
}

let chartResizeTimer = null;

function scheduleChartLayoutUpdate() {
  window.clearTimeout(
    chartResizeTimer
  );

  chartResizeTimer =
    window.setTimeout(
      () => {
        const nextLayoutKey =
          getChartLayout().key;

        if (
          nextLayoutKey !==
          lastChartLayoutKey
        ) {
          renderChart(
            calculateCombinations()
          );
        }
      },
      100
    );
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

function serializeChartSvgForPdf() {
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
      "stroke-width",
      "color",
      "opacity",
      "display",
      "visibility",
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

  clone.querySelectorAll(
    ".chart-hit-target"
  ).forEach(
    node => node.remove()
  );

  const serializer =
    new XMLSerializer();

  return serializer.serializeToString(
    clone
  );
}

async function chartToPngDataUrl() {
  const allData =
    calculateCombinations();

  if (!allData.length) {
    return null;
  }

  let svgText = null;

  try {
    renderChart(
      allData,
      { forceDesktop: true }
    );

    svgText =
      serializeChartSvgForPdf();
  } finally {
    renderChart(
      allData
    );
  }

  if (!svgText) {
    return null;
  }

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

$("expandChart").addEventListener(
  "click",
  () => setChartExpanded(
    !chartExpanded
  )
);

$("clearChartSelection").addEventListener(
  "click",
  clearChartSelection
);

window.addEventListener(
  "resize",
  scheduleChartLayoutUpdate
);

$("generatePdf").addEventListener(
  "click",
  generatePdfReport
);

let deferredInstallPrompt = null;

function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

function showInstallHelp(message) {
  const help = $("installAppHelp");
  help.textContent = message;
  help.hidden = false;
}

async function installCogSmith() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();

    const { outcome } =
      await deferredInstallPrompt.userChoice;

    deferredInstallPrompt = null;

    if (outcome === "dismissed") {
      showInstallHelp(
        "Installation was dismissed. You can try again from your browser menu."
      );
    }

    return;
  }

  if (isIosDevice()) {
    showInstallHelp(
      "On iPhone or iPad, tap the Share button, then choose Add to Home Screen."
    );
    return;
  }

  showInstallHelp(
    "Open your browser menu and choose Install app or Add to Home screen."
  );
}

function setupInstallExperience() {
  const installApp = $("installApp");
  const installButton = $("installAppButton");

  if (isInstalledApp()) {
    installApp.hidden = true;
    return;
  }

  installButton.addEventListener("click", installCogSmith);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("installAppHelp").hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installApp.hidden = true;
  });

  if ("serviceWorker" in window.navigator) {
    window.addEventListener("load", () => {
      window.navigator.serviceWorker
        .register("./sw.js", { scope: "./" })
        .catch(error => {
          console.warn("CogSmith service worker registration failed:", error);
        });
    });
  }
}

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
setupInstallExperience();
