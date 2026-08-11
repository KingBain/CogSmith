import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const baseDirectory = resolve(process.argv[2] ?? ".visual-review/base");
const headDirectory = resolve(process.argv[3] ?? ".");
const outputDirectory = resolve("visual-review");

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
      const path = `${outputDirectory}/${version}-${view.name}-${capture.name}.png`;
      if (capture.fullPage) {
        await page.screenshot({ path, fullPage: true });
      } else {
        await capture.locator(page).screenshot({ path });
      }
    }

    await context.close();
  }
}

function createReport() {
  const sections = captures.map(capture => `
    <section>
      <h2>${capture.name.replace("-", " ")}</h2>
      ${views.map(view => `
        <h3>${view.name}</h3>
        <div class="comparison">
          <figure><figcaption>Before (main)</figcaption><img src="base-${view.name}-${capture.name}.png" alt="Main branch ${view.name} ${capture.name}"></figure>
          <figure><figcaption>After (pull request)</figcaption><img src="head-${view.name}-${capture.name}.png" alt="Pull request ${view.name} ${capture.name}"></figure>
        </div>
      `).join("")}
    </section>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CogSmith visual review</title>
<style>
body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#f4f5f7;color:#172033}main{max-width:1800px;margin:auto}section{margin:24px 0;padding:20px;background:white;border:1px solid #d9dee8;border-radius:12px}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;min-width:0}figcaption{margin-bottom:8px;font-weight:700}img{display:block;width:100%;height:auto;border:1px solid #d9dee8;border-radius:8px}@media(max-width:800px){.comparison{grid-template-columns:1fr}}
</style></head><body><main><h1>CogSmith visual review</h1><p>Compare the main branch with the pull request at desktop and mobile widths.</p>${sections}</main></body></html>`;
}

await mkdir(outputDirectory, { recursive: true });
const base = await serve(baseDirectory);
const head = await serve(headDirectory);
const browser = await chromium.launch();

try {
  await captureVersion(browser, "base", base.url);
  await captureVersion(browser, "head", head.url);
  await writeFile(`${outputDirectory}/index.html`, createReport());
} finally {
  await browser.close();
  base.server.close();
  head.server.close();
}
