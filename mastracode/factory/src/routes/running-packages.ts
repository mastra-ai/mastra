import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RunningPackage {
  name: string;
  version: string;
}

/** Written by `mastra dev` and `mastra build`. */
const MANIFEST_FILE_NAME = 'mastra-packages.json';

const bundleDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Where the packages manifest can be: the file `mastra dev` points at, next to
 * the server entry (`node .mastra/output/index.mjs`), next to this module once
 * bundled, or the build output under the working directory.
 */
export function packagesManifestCandidates(
  env: NodeJS.ProcessEnv = process.env,
  entry: string | undefined = process.argv[1],
  cwd: string = process.cwd(),
): string[] {
  return [
    env.MASTRA_PACKAGES_FILE,
    entry ? join(dirname(entry), MANIFEST_FILE_NAME) : undefined,
    join(bundleDirectory, MANIFEST_FILE_NAME),
    join(cwd, '.mastra', 'output', MANIFEST_FILE_NAME),
  ].filter((path): path is string => !!path);
}

/** The Mastra packages this server was built with, sorted by name. Empty when no manifest is found. */
export async function readRunningPackages(
  candidates: string[] = packagesManifestCandidates(),
): Promise<RunningPackage[]> {
  for (const path of candidates) {
    let contents: string;
    try {
      contents = await readFile(path, 'utf-8');
    } catch {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (entry): entry is RunningPackage => typeof entry?.name === 'string' && typeof entry?.version === 'string',
        )
        .map(({ name, version }) => ({ name, version }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
  return [];
}
