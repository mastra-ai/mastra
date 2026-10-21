import {
  extractionFile,
  extractionFingerprint,
  isWithin,
  repositoryBoundary,
} from "./standalone-files.ts";
import { cp, mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const root = process.cwd();
const destination = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(await mkdtemp(resolve(tmpdir(), "genui-standalone-")), "template");
if (isWithin(repositoryBoundary(root), destination))
  throw new Error("Prepare a new standalone directory outside the repository.");
const fingerprint = await extractionFingerprint(root);
await cp(root, destination, {
  recursive: true,
  errorOnExist: true,
  force: false,
  filter: extractionFile,
});
await new Promise<void>((complete, reject) => {
  const child = spawn("npm", ["ci"], {
    cwd: destination,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: resolve(destination, ".npm-cache"),
      npm_config_workspaces: "false",
    },
  });
  child.once("error", reject);
  child.once("exit", (code) =>
    code === 0
      ? complete()
      : reject(new Error("Standalone npm ci failed; preserve the extraction for diagnosis.")),
  );
});
await mkdir(".data", { recursive: true });
await writeFile(".data/standalone.json", JSON.stringify({ directory: destination, fingerprint }));
console.log(`Prepared independent NPM extraction: ${destination}`);
