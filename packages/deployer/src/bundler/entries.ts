import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { slash } from '../build/utils';

/** Reserved by the server bundle (`index.mjs`). */
const SERVER_ENTRY_NAME = 'index';
/**
 * Reserved by the tool aggregator, which `_bundle` writes to `tools.mjs` with `writeFile`
 * *after* rollup finishes. Rollup deduplicates colliding chunk names, but that write
 * happens outside its control, so an entry named `tools` is silently overwritten.
 */
const TOOLS_ENTRY_NAME = 'tools';
/** Reserved by tool bundles (`tools/<uuid>.mjs`), which the aggregator collects by prefix. */
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

    // Normalize before every reserved-name check. A backslash form like `tools\worker`
    // would otherwise pass validation and then be normalized into `tools/worker`, which
    // the tool aggregator absorbs by prefix.
    const normalizedName = slash(name);

    if (normalizedName === SERVER_ENTRY_NAME) {
      throw invalidEntries(
        `bundler.entries cannot use the name "${SERVER_ENTRY_NAME}" — it is reserved for the Mastra server bundle.`,
      );
    }

    if (normalizedName === TOOLS_ENTRY_NAME || normalizedName.startsWith(TOOLS_ENTRY_PREFIX)) {
      throw invalidEntries(
        `bundler.entries cannot use the name "${name}" — "${TOOLS_ENTRY_NAME}" and names starting with "${TOOLS_ENTRY_PREFIX}" are reserved for tool bundles.`,
      );
    }

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
