import { cp, lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

export const distributableFiles = [
  ".env.example",
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  ".prettierignore",
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "package.json",
  "package-lock.json",
  "playwright.config.ts",
  "tsconfig.json",
  "vitest.config.ts",
];
export const distributableDirectories = [
  "client-demo-ui",
  "config",
  "docs",
  "evals",
  "scripts",
  "src",
  "support-demo-ui",
  "test",
];

export async function createDistributableSnapshot(
  source,
  prefix = "support-refund-snapshot-",
) {
  const root = resolve(source);
  const destination = await mkdtemp(join(tmpdir(), prefix));
  try {
    await assertDistributableTree(root);
    for (const path of distributableFiles)
      await cp(join(root, path), join(destination, path), {
        errorOnExist: true,
      });
    for (const path of distributableDirectories)
      await cp(join(root, path), join(destination, path), {
        recursive: true,
        errorOnExist: true,
        filter: (candidate) => !isExcluded(root, candidate),
      });
    return {
      destination,
      fingerprint: await distributableFingerprint(destination),
    };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

export async function distributableFingerprint(source) {
  const root = resolve(source);
  const files = [];
  for (const path of distributableFiles) files.push(path);
  for (const directory of distributableDirectories)
    await collectFiles(join(root, directory), root, files);
  const hash = createHash("sha256");
  for (const path of files.sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(await readFile(join(root, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function assertNoDistributedWhitespace(source) {
  const root = resolve(source);
  const files = [];
  for (const path of distributableFiles) files.push(path);
  for (const directory of distributableDirectories)
    await collectFiles(join(root, directory), root, files);
  const errors = [];
  for (const path of files.sort()) {
    const content = await readFile(join(root, path));
    if (content.includes(0)) continue;
    const lines = content.toString("utf8").split("\n");
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line))
        errors.push(`${path}:${index + 1} trailing whitespace`);
      if (/^ +\t/.test(line))
        errors.push(`${path}:${index + 1} space before tab in indentation`);
    });
  }
  if (errors.length)
    throw new Error(
      `Distributed-file whitespace validation failed:\n- ${errors.join("\n- ")}`,
    );
}

async function collectFiles(directory, root, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (isExcluded(root, join(directory, entry.name))) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path, root, files);
    else if (entry.isFile()) files.push(relative(root, path));
  }
}

function isExcluded(root, candidate) {
  const path = relative(root, candidate);
  const name = path.split(/[\\/]/).at(-1);
  return (
    !name ||
    [
      "node_modules",
      "dist",
      ".data",
      ".git",
      ".mastra",
      "logs",
      "coverage",
      "playwright-report",
      "test-results",
      ".cache",
    ].includes(name) ||
    (name.startsWith(".env") && name !== ".env.example") ||
    /\.(?:db|sqlite)(?:-(?:wal|shm|journal))?$/.test(name) ||
    /\.(?:tsbuildinfo|log)$/.test(name) ||
    path === "src/mastra/public" ||
    path.startsWith("src/mastra/public/")
  );
}

async function assertDistributableTree(root) {
  for (const path of distributableFiles)
    await assertRegularFile(join(root, path));
  for (const directory of distributableDirectories)
    await assertNoSymlinks(join(root, directory), root);
}

async function assertRegularFile(path) {
  const entry = await lstat(path);
  if (entry.isSymbolicLink() || !entry.isFile())
    throw new Error(`Distributable snapshot rejects symlink ${path}.`);
}

async function assertNoSymlinks(directory, root) {
  const rootEntry = await lstat(directory);
  if (rootEntry.isSymbolicLink() || !rootEntry.isDirectory())
    throw new Error(
      `Distributable snapshot rejects symlink ${relative(root, directory)}.`,
    );
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (isExcluded(root, path)) continue;
    if (entry.isSymbolicLink())
      throw new Error(
        `Distributable snapshot rejects symlink ${relative(root, path)}.`,
      );
    if (entry.isDirectory()) await assertNoSymlinks(path, root);
    else if (!entry.isFile())
      throw new Error(
        `Distributable snapshot rejects non-file ${relative(root, path)}.`,
      );
  }
}
