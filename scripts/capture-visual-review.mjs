import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const baseDirectory = resolve(process.argv[2] ?? ".visual-review/base");
const headDirectory = resolve(process.argv[3] ?? ".");
const outputDirectory = resolve("visual-review");
const prNumber = process.env.PR_NUMBER;

if (!/^\d+$/.test(prNumber ?? "")) {
  throw new Error("PR_NUMBER must contain only digits");
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url, "http://localhost").pathname;
      const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
      const filePath = resolve(directory, relativePath);

      if (filePath !== directory && !filePath.startsWith(`${directory}${sep}`)) {
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

  return new Promise(resolveServer => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolveServer({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const views = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } }
];

const captures = [
  { name: "full-page", locator: page => page.locator("body"), fullPage: true },
  { name: "summary", locator: page => page.locator(".stats") },
  {
    name: "results",
    locator: page => page.locator("section.panel").filter({
      has: page.getByRole("heading", { name: "Best combinations" })
    })
  }
];

async function captureVersion(browser, version, url) {
  for (const view of views) {
    const context = await browser.newContext({
      colorScheme: "light",
      viewport: view.viewport
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("#results tr").first().waitFor();

    for (const capture of captures) {
      const path =
        `${outputDirectory}/pr-${prNumber}-${version}-${view.name}-${capture.name}.png`;
      if (capture.fullPage) {
        await page.screenshot({ path, fullPage: true });
      } else {
        await capture.locator(page).screenshot({ path });
      }
    }

    await context.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
const base = await serve(baseDirectory);
const head = await serve(headDirectory);
const browser = await chromium.launch();

try {
  await captureVersion(browser, "base", base.url);
  await captureVersion(browser, "head", head.url);
} finally {
  await browser.close();
  base.server.close();
  head.server.close();
}
