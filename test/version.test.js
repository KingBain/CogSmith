import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { stampBuild } from "../scripts/stamp-build.mjs";

await import("../version.js");

test("the application version uses stable semantic versioning", () => {
  assert.match(
    globalThis.COGSMITH_VERSION.version,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  );
  assert.equal(globalThis.COGSMITH_VERSION.build, "__COGSMITH_BUILD_ID__");
  assert.equal(Object.isFrozen(globalThis.COGSMITH_VERSION), true);
});

test("deployment stamping replaces the cache build identifier", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cogsmith-version-"));
  const versionFile = join(directory, "version.js");

  t.after(() => rm(directory, { recursive: true, force: true }));

  await writeFile(
    versionFile,
    'globalThis.COGSMITH_VERSION = { build: "__COGSMITH_BUILD_ID__" };\n',
  );

  const buildId = await stampBuild(
    "99242f2a42cb559f04a7c49dc19475bcb545f0a7",
    versionFile,
  );
  const stampedSource = await readFile(versionFile, "utf8");

  assert.equal(buildId, "99242f2a42cb");
  assert.match(stampedSource, /build: "99242f2a42cb"/);
  assert.doesNotMatch(stampedSource, /__COGSMITH_BUILD_ID__/);
});

test("deployment stamping rejects invalid build identifiers", async () => {
  await assert.rejects(
    stampBuild("not-a-commit"),
    /Build ID must be a 7-64 character hexadecimal commit SHA/,
  );
});
