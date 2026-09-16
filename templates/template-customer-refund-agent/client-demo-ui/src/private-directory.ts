import { lstat, realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

export function isInside(directory: string, candidate: string) {
  const path = relative(directory, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

export async function gitRepositoryRoot(start: string) {
  let directory = await realpath(start);
  while (true) {
    try {
      const marker = await lstat(join(directory, ".git"));
      if (marker.isDirectory() || marker.isFile()) return directory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

async function canonicalCandidate(path: string) {
  const parts: string[] = [];
  let existing = resolve(path);
  while (true) {
    try {
      await lstat(existing);
      return resolve(await realpath(existing), ...parts.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      parts.push(basename(existing));
      existing = parent;
    }
  }
}

export async function privateDirectoryConfiguration({
  templateRoot,
  requestedDirectory,
}: {
  templateRoot: string;
  requestedDirectory?: string;
}) {
  const template = await realpath(templateRoot);
  const repository = (await gitRepositoryRoot(template)) ?? template;
  const requested = resolve(
    requestedDirectory ?? resolve(repository, "..", "demo-private"),
  );
  const canonicalRequested = await canonicalCandidate(requested);
  if (isInside(repository, canonicalRequested))
    throw new Error("DEMO_PRIVATE_DIR must be outside the Git repository.");
  return { repository, requested };
}
