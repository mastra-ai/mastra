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
 * Compile glob pattern(s) into a reusable matcher function.
 * The matcher tests paths using workspace-style forward slashes.
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
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  const matcher = picomatch(patternArray, {
    posix: true,
    dot: options?.dot ?? false,
  });
  return matcher;
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
