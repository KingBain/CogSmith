import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const BUILD_ID_TOKEN = "__COGSMITH_BUILD_ID__";

export async function stampBuild(buildId, versionFile = "version.js") {
  if (!/^[0-9a-f]{7,64}$/i.test(buildId ?? "")) {
    throw new Error("Build ID must be a 7-64 character hexadecimal commit SHA");
  }

  const source = await readFile(versionFile, "utf8");

  if (!source.includes(BUILD_ID_TOKEN)) {
    throw new Error(`${versionFile} does not contain the build ID token`);
  }

  const shortBuildId = buildId.slice(0, 12).toLowerCase();
  await writeFile(versionFile, source.replaceAll(BUILD_ID_TOKEN, shortBuildId));

  return shortBuildId;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const stampedBuild = await stampBuild(process.argv[2]);
  console.log(`Stamped CogSmith build ${stampedBuild}`);
}
