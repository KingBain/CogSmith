import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

import "../version.js";

const siteDirectory = resolve(".");
const expectedVersion = globalThis.COGSMITH_VERSION.version;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url, "http://localhost").pathname;
    const relativePath =
      requestPath === "/" ? "index.html" : requestPath.slice(1);
    const filePath = resolve(siteDirectory, relativePath);

    if (
      filePath !== siteDirectory &&
      !filePath.startsWith(`${siteDirectory}${sep}`)
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type":
        mimeTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveServer) =>
  server.listen(0, "127.0.0.1", resolveServer),
);

const { port } = server.address();
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const registeredTools = new Map();

    Object.defineProperty(globalThis, "__cogsmithWebMcpTools", {
      value: registeredTools,
    });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (tool) => {
          registeredTools.set(tool.name, tool);
        },
      },
    });
  });

  const response = await page.goto(`http://127.0.0.1:${port}`, {
    waitUntil: "networkidle",
  });

  assert.equal(
    response?.status(),
    200,
    "The application should load successfully",
  );
  await page.locator("#results tr").first().waitFor();

  assert.equal(
    (await page.locator("#appVersion").textContent())?.trim(),
    `CogSmith v${expectedVersion}`,
    "The site footer should display the application version",
  );
  assert.equal(
    await page.locator("#appVersion").getAttribute("href"),
    `https://github.com/KingBain/CogSmith/releases/tag/v${expectedVersion}`,
    "The footer version should link to its GitHub release",
  );

  const bestCombination = (
    await page.locator("#bestCombo").textContent()
  )?.trim();
  assert.match(
    bestCombination ?? "",
    /^\d+ × \d+$/,
    "The calculator should produce a best combination",
  );

  await page.waitForFunction(
    () => globalThis.__cogsmithWebMcpTools?.size === 3,
  );
  const webMcpToolNames = await page.evaluate(() => [
    ...globalThis.__cogsmithWebMcpTools.keys(),
  ]);

  assert.deepEqual(
    webMcpToolNames,
    [
      "get_current_bike_setup",
      "calculate_gearing_options",
      "show_gearing_setup",
    ],
    "CogSmith should register its three WebMCP tools",
  );

  const currentSetup = await page.evaluate(async () =>
    globalThis.__cogsmithWebMcpTools.get("get_current_bike_setup").execute({}),
  );

  assert.equal(currentSetup.success, true);
  assert.equal(currentSetup.setup.units, "metric");
  assert.deepEqual(currentSetup.setup.chainrings, [28, 38, 48]);

  const calculation = await page.evaluate(async () =>
    globalThis.__cogsmithWebMcpTools.get("calculate_gearing_options").execute({
      units: "metric",
      chainrings: [38],
      rearCogs: [18],
      wheelDiameter: 660.4,
      chainstayLength: 423,
      dropoutTravel: 10,
      targetGearInches: 55,
      gearTolerance: 2,
      includeHalfLink: true,
      maxResults: 2,
    }),
  );

  assert.equal(calculation.success, true);
  assert.equal(calculation.returnedCombinations, 2);
  assert.equal(
    await page.locator("#wheel").inputValue(),
    "660.4",
    "The read-only calculation tool should not change the form",
  );

  const shownSetup = await page.evaluate(async () =>
    globalThis.__cogsmithWebMcpTools.get("show_gearing_setup").execute({
      units: "metric",
      chainrings: [38],
      rearCogs: [18],
      wheelDiameter: 660.4,
      chainstayLength: 423,
      dropoutTravel: 10,
      targetGearInches: 55,
      gearTolerance: 2,
      includeHalfLink: true,
    }),
  );

  assert.equal(shownSetup.success, true);
  assert.equal(
    (await page.locator("#ringSummary").textContent())?.trim(),
    "38T",
  );
  assert.equal(
    (await page.locator("#cogSummary").textContent())?.trim(),
    "18T",
  );
  assert.equal(await page.locator("#halfLink").isChecked(), true);
  assert.equal(
    (await page.locator("#bestCombo").textContent())?.trim(),
    "38 × 18",
    "The mutating WebMCP tool should redraw the visible calculator",
  );

  await page.getByRole("button", { name: "Imperial" }).click();
  assert.equal(
    await page.locator("#wheelLabel").textContent(),
    "Wheel diameter (in)",
    "The unit selector should update the calculator",
  );

  assert.deepEqual(
    pageErrors,
    [],
    `Unexpected browser errors: ${pageErrors.join(", ")}`,
  );
} finally {
  await browser.close();
  server.close();
}
