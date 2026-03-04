/**
 * Glob Pattern Utilities
 *
 * Shared glob pattern matching for workspace operations.
 * Uses picomatch for battle-tested glob support including
 * brace expansion, character classes, negation, and `**`.
 */

import picomatch from 'picomatch';

// =============================================================================
// Glob Metacharacter Detection
// =============================================================================

/** Characters that indicate a glob pattern (not a plain path) */
const GLOB_CHARS = /[*?{}[\]]/;

/**
 * Check if a string contains glob metacharacters.
 *
 * @example
 * isGlobPattern('/docs')           // false
 * isGlobPattern('/docs/**\/*.md')   // true
 * isGlobPattern('*.ts')            // true
 * isGlobPattern('/src/{a,b}')      // true
 */
export function isGlobPattern(input: string): boolean {
  return GLOB_CHARS.test(input);
}

// =============================================================================
// Glob Base Extraction
// =============================================================================

/**
 * Extract the static directory prefix before the first glob metacharacter.
 * Returns the deepest non-glob ancestor directory.
 *
 * @example
 * extractGlobBase('/docs/**\/*.md')  // '/docs'
 * extractGlobBase('**\/*.md')        // '/'
 * extractGlobBase('/src/*.ts')      // '/src'
 * extractGlobBase('/exact/path')    // '/exact/path'
 */
export function extractGlobBase(pattern: string): string {
  // Find position of first glob metacharacter
  const firstMeta = pattern.search(GLOB_CHARS);

  if (firstMeta === -1) {
    // No glob chars — return the pattern as-is (it's a plain path)
    return pattern;
  }

  // Get the portion before the first metacharacter
  const prefix = pattern.slice(0, firstMeta);

  // Walk back to the last directory separator
  const lastSlash = prefix.lastIndexOf('/');

  if (lastSlash <= 0) {
    // No slash or only root slash — base is root
    return '/';
  }

  return prefix.slice(0, lastSlash);
}

// =============================================================================
// Glob Matcher
// =============================================================================

/** A compiled matcher function: returns true if a path matches */
export type GlobMatcher = (path: string) => boolean;

export interface GlobMatcherOptions {
  /** Match dotfiles (default: false) */
  dot?: boolean;
}

/**
 * Strip leading './' or '/' from a path for picomatch matching.
 * picomatch does not match paths with these prefixes, so both
 * patterns and test paths must be normalized before matching.
 *
 * This only affects matching — filesystem paths should keep their
 * original form for correct resolution with contained/uncontained modes.
 */
function normalizeForMatch(input: string): string {
  if (input.startsWith('./')) return input.slice(2);
  if (input.startsWith('/')) return input.slice(1);
  return input;
}

/**
 * Compile glob pattern(s) into a reusable matcher function.
 * The matcher tests paths using workspace-style forward slashes.
 *
 * Automatically normalizes leading './' and '/' from both patterns
 * and test paths, since picomatch does not match these prefixes.
 *
 * @example
 * const match = createGlobMatcher('**\/*.ts');
 * match('src/index.ts')     // true
 * match('src/style.css')    // false
 *
 * const multi = createGlobMatcher(['**\/*.ts', '**\/*.tsx']);
 * multi('App.tsx')           // true
 */
export function createGlobMatcher(patterns: string | string[], options?: GlobMatcherOptions): GlobMatcher {
  const patternArray = (Array.isArray(patterns) ? patterns : [patterns]).map(normalizeForMatch);
  const matcher = picomatch(patternArray, {
    posix: true,
    dot: options?.dot ?? false,
  });
  return (path: string) => matcher(normalizeForMatch(path));
}

/**
 * One-off convenience: test if a path matches a glob pattern.
 *
 * For repeated matching against the same pattern, prefer createGlobMatcher()
 * to compile once and reuse.
 *
 * @example
 * matchGlob('src/index.ts', '**\/*.ts')  // true
 */
export function matchGlob(path: string, pattern: string | string[], options?: GlobMatcherOptions): boolean {
  return createGlobMatcher(pattern, options)(path);
}

// =============================================================================
// Path Pattern Resolution
// =============================================================================

/** A filesystem entry returned by resolvePathPattern */
export interface PathEntry {
  path: string;
  type: 'file' | 'directory';
}

/** Minimal readdir entry — compatible with both FileEntry and SkillSourceEntry */
export interface ReaddirEntry {
  name: string;
  type: 'file' | 'directory';
  isSymlink?: boolean;
}

export interface ResolvePathOptions {
  /** Match dotfiles (default: false) */
  dot?: boolean;
  /** Maximum directory depth to walk (default: 10) */
  maxDepth?: number;
}

/**
 * Walk a directory tree recursively, returning all entries (files and directories).
 * Skips symlinked directories to prevent infinite loops.
 */
async function walkAll(
  readdir: (dir: string) => Promise<ReaddirEntry[]>,
  dir: string,
  depth: number,
  maxDepth: number,
): Promise<PathEntry[]> {
  if (depth >= maxDepth) return [];
  try {
    const entries = await readdir(dir);
    const results: PathEntry[] = [];
    for (const entry of entries) {
      if (entry.type === 'directory' && entry.isSymlink) continue;
      const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
      results.push({ path: fullPath, type: entry.type });
      if (entry.type === 'directory') {
        results.push(...(await walkAll(readdir, fullPath, depth + 1, maxDepth)));
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Resolve a path pattern to matching filesystem entries.
 *
 * Handles both plain paths and glob patterns consistently:
 * - Plain paths: determines file vs directory via readdir probe, returns single entry
 * - Glob patterns: walks from the glob base, matches both files and directories
 *
 * @example
 * // Plain paths
 * resolvePathPattern('/docs', readdir)            // [{ path: '/docs', type: 'directory' }]
 * resolvePathPattern('/docs/readme.md', readdir)  // [{ path: '/docs/readme.md', type: 'file' }]
 *
 * // Glob patterns — matches files and directories
 * resolvePathPattern('/docs/**\/*.md', readdir)    // all .md files under /docs
 * resolvePathPattern('**\/skills', readdir)         // all directories (and files) named 'skills'
 * resolvePathPattern('/skills/**', readdir)         // everything under /skills
 */
export async function resolvePathPattern(
  pattern: string,
  readdir: (dir: string) => Promise<ReaddirEntry[]>,
  options?: ResolvePathOptions,
): Promise<PathEntry[]> {
  const maxDepth = options?.maxDepth ?? 10;

  // Strip trailing slash for consistent path handling (e.g. '/skills/' → '/skills')
  const normalized = pattern.length > 1 && pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

  if (!isGlobPattern(normalized)) {
    // Plain path — probe with readdir to determine if it's a directory or file
    try {
      await readdir(normalized);
      return [{ path: normalized, type: 'directory' }];
    } catch {
      // readdir failed — treat as a file path (consumer handles non-existence)
      return [{ path: normalized, type: 'file' }];
    }
  }

  // Glob pattern — walk from base, match all entries (files and directories)
  const walkRoot = extractGlobBase(normalized);
  const matcher = createGlobMatcher(normalized, { dot: options?.dot ?? false });
  const allEntries = await walkAll(readdir, walkRoot, 0, maxDepth);
  return allEntries.filter(entry => matcher(entry.path));
}
