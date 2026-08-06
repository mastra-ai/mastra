import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { slash } from '../build/utils';

/** Reserved by the server bundle (`index.mjs`). */
const SERVER_ENTRY_NAME = 'index';
/** Reserved by tool bundles (`tools/<uuid>.mjs`). */
const TOOLS_ENTRY_PREFIX = 'tools/';

function invalidEntries(text: string): MastraError {
  return new MastraError({
    id: 'DEPLOYER_BUNDLER_INVALID_ENTRIES',
    text,
    domain: ErrorDomain.DEPLOYER,
    category: ErrorCategory.USER,
  });
}

/**
 * Resolves the user's `bundler.entries` config into the absolute source paths the
 * bundler emits beside the server bundle.
 *
 * Names become output filenames (`<name>.mjs` via rollup's `entryFileNames`), so they
 * are rejected when they would collide with the server or tool bundles, or when they
 * would escape the output directory. Paths resolve relative to the Mastra directory —
 * the directory holding the entry file — so they read the same way as the imports
 * already in that file.
 */
export function resolveExtraEntries(
  entries: Record<string, string> | undefined,
  mastraEntryFile: string,
): Record<string, string> {
  if (!entries) {
    return {};
  }

  const mastraDir = dirname(mastraEntryFile);
  const resolved: Record<string, string> = {};

  for (const [name, entryPath] of Object.entries(entries)) {
    if (!name || name !== name.trim()) {
      throw invalidEntries(`bundler.entries has an empty or untrimmed entry name: ${JSON.stringify(name)}`);
    }

    if (name === SERVER_ENTRY_NAME) {
      throw invalidEntries(
        `bundler.entries cannot use the name "${SERVER_ENTRY_NAME}" — it is reserved for the Mastra server bundle.`,
      );
    }

    if (name.startsWith(TOOLS_ENTRY_PREFIX)) {
      throw invalidEntries(
        `bundler.entries cannot use the name "${name}" — names starting with "${TOOLS_ENTRY_PREFIX}" are reserved for tool bundles.`,
      );
    }

    const normalizedName = slash(name);
    if (isAbsolute(name) || normalizedName.startsWith('/') || normalizedName.split('/').includes('..')) {
      throw invalidEntries(
        `bundler.entries name "${name}" must be a relative name without ".." segments — it becomes a file inside the build output.`,
      );
    }

    if (!entryPath) {
      throw invalidEntries(`bundler.entries entry "${name}" has an empty path.`);
    }

    const absolutePath = isAbsolute(entryPath) ? entryPath : resolve(mastraDir, entryPath);

    if (!existsSync(absolutePath)) {
      throw invalidEntries(
        `bundler.entries entry "${name}" points at "${entryPath}", which does not exist (resolved to ${absolutePath}). Paths are resolved relative to your Mastra directory (${mastraDir}).`,
      );
    }

    resolved[normalizedName] = slash(absolutePath);
  }

  return resolved;
}
