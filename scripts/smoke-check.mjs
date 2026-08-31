import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const siteDirectory = resolve(".");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url, "http://localhost").pathname;
    const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
    const filePath = resolve(siteDirectory, relativePath);

    if (filePath !== siteDirectory && !filePath.startsWith(`${siteDirectory}${sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise(resolveServer => server.listen(0, "127.0.0.1", resolveServer));

const { port } = server.address();
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const response = await page.goto(`http://127.0.0.1:${port}`, {
    waitUntil: "networkidle"
  });

  assert.equal(response?.status(), 200, "The application should load successfully");
  await page.locator("#results tr").first().waitFor();

  const bestCombination = (await page.locator("#bestCombo").textContent())?.trim();
  assert.match(
    bestCombination ?? "",
    /^\d+ × \d+$/,
    "The calculator should produce a best combination"
  );

  await page.getByRole("button", { name: "Imperial" }).click();
  assert.equal(
    await page.locator("#wheelLabel").textContent(),
    "Wheel diameter (in)",
    "The unit selector should update the calculator"
  );

  assert.deepEqual(pageErrors, [], `Unexpected browser errors: ${pageErrors.join(", ")}`);
} finally {
  await browser.close();
  server.close();
}
