import { realpathSync } from 'node:fs';
import { slash } from '../utils';

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches one file's module id. Rolldown normalizes separators to `/` before testing id filters, so the path is
 * slashed to keep Windows entries matching. The real path also matches because Rolldown follows symlinks unless a
 * pass preserves them (e.g. macOS temp dirs live under `/var` -> `/private/var`).
 */
export function exactPathRegex(path: string): RegExp {
  const paths = new Set([slash(path)]);
  try {
    paths.add(slash(realpathSync(path)));
  } catch {
    // Not on disk (yet); only the given path can match.
  }
  return exactIdsRegex(paths)!;
}

/** Matches any of the given ids exactly. Returns `null` when there is nothing to match. */
export function exactIdsRegex(ids: Iterable<string>): RegExp | null {
  const alternatives = [...ids].map(escapeRegExp);
  if (!alternatives.length) {
    return null;
  }
  return new RegExp(`^(?:${alternatives.join('|')})$`);
}

/** Matches `pkg` and `pkg/...` for every given package name. */
export function packagesRegex(packageNames: Iterable<string>): RegExp | null {
  const alternatives = [...packageNames].map(escapeRegExp);
  if (!alternatives.length) {
    return null;
  }
  return new RegExp(`^(?:${alternatives.join('|')})(?:/|$)`);
}

/** Matches only `pkg/...` subpaths for every given package name. */
export function packageSubpathsRegex(packageNames: Iterable<string>): RegExp | null {
  const alternatives = [...packageNames].map(escapeRegExp);
  if (!alternatives.length) {
    return null;
  }
  return new RegExp(`^(?:${alternatives.join('|')})/`);
}

/**
 * Cheap pre-filter for bare module specifiers (no relative/absolute paths, virtual ids, `#imports` or drive letters).
 * Handlers still have to check `isBareModuleSpecifier` because builtins and protocol imports also match.
 */
export const BARE_SPECIFIER_FILTER = /^(?![./\\\0#]|[A-Za-z]:[\\/])/;

/**
 * Protocol imports such as `cloudflare:workers` or `data:` URLs, minus `node:` builtins and Windows drive paths.
 * Used in `external` so Rolldown keeps them as-is without calling into JS.
 */
export const EXTERNAL_PROTOCOL_RE = /^(?![A-Za-z]:[\\/])(?!node:)[A-Za-z][A-Za-z\d+.-]*:/;

/** Module ids coming from installed packages or prebuilt Mastra output, which user-code-only transforms skip. */
export const NON_USER_CODE_IDS = [/[\\/]node_modules[\\/]/, /[\\/]\.mastra[\\/]/, /^\0/];
