import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** An extracted template may have no repository; in that case protect the template itself. */
export function repositoryBoundary(directory: string) {
  const root = resolve(directory);
  for (let candidate = root; ; candidate = dirname(candidate)) {
    if (existsSync(join(candidate, ".git"))) return candidate;
    if (dirname(candidate) === candidate) return root;
  }
}
export function isWithin(directory: string, candidate: string) {
  const offset = relative(directory, candidate);
  return (
    offset === "" || (offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))
  );
}

const generated = new Set([
  "node_modules",
  ".npm-cache",
  ".next",
  ".mastra",
  ".data",
  "dist",
  "coverage",
  ".git",
  ".vscode",
  "next-env.d.ts",
]);
/** Exclude reserved generated names at every depth, including nested test apps. */
export function extractionFile(path: string) {
  const name = basename(path);
  return (
    !generated.has(name) &&
    !name.endsWith(".tsbuildinfo") &&
    (name === ".env.example" || !name.startsWith(".env"))
  );
}
/** Hash the same deliverable files copied by preparation; generated output and credentials are excluded. */
export async function extractionFingerprint(directory: string) {
  const hash = createHash("sha256");
  async function visit(relative: string) {
    const entries = (await readdir(join(directory, relative), { withFileTypes: true })).toSorted(
      (a, b) => a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const path = join(relative, entry.name);
      if (!extractionFile(path)) continue;
      if (entry.isSymbolicLink())
        throw new Error("Standalone preparation does not accept linked deliverable files.");
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        hash.update(path);
        hash.update("\0");
        hash.update(await readFile(join(directory, path)));
        hash.update("\0");
      }
    }
  }
  await visit("");
  return hash.digest("hex");
}
