import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Rewrites a single relative specifier to its emitted Node ESM path.
 *
 * @param {string} specifier - Relative specifier (e.g. './foo', '../bar')
 * @param {(spec: string) => string | null} resolveSuffix - Returns '.js', '/index.js', or null
 * @returns {string | null} Rewritten specifier or null if no change needed
 */
export function rewriteSpecifier(specifier, resolveSuffix) {
  // TypeScript extension → replace with .js
  if (/\.(ts|tsx)$/i.test(specifier)) {
    return specifier.replace(/\.(ts|tsx)$/i, '.js');
  }

  // Trailing slash → directory import, append index.js
  if (specifier.endsWith('/')) {
    return specifier + 'index.js';
  }

  // Already has a non-TS file extension (e.g., .js, .json, .css) → leave unchanged
  if (/\.[a-z]+$/i.test(specifier)) return null;

  // No extension → resolve from filesystem
  const suffix = resolveSuffix(specifier);
  return suffix ? specifier + suffix : null;
}

/**
 * Rewrites all extensionless relative specifiers in TypeScript source code
 * to their emitted Node ESM paths.
 *
 * @param {string} source - TypeScript source code
 * @param {(spec: string) => string | null} resolveSuffix - Returns '.js', '/index.js', or null
 * @returns {string} Rewritten source
 */
export function rewriteRelativeSpecifiers(source, resolveSuffix) {
  let result = source;

  // from '...' or from "..." (static import/export with from keyword)
  result = result.replace(
    /\bfrom\s*(['"])(\.\.?\/[^'"]+)\1/g,
    (match, quote, specifier) => {
      const rewritten = rewriteSpecifier(specifier, resolveSuffix);
      return rewritten ? `from ${quote}${rewritten}${quote}` : match;
    },
  );

  // import('...') or import("...") (dynamic import)
  result = result.replace(
    /\bimport\s*\(\s*(['"])(\.\.?\/[^'"]+)\1/g,
    (match, quote, specifier) => {
      const rewritten = rewriteSpecifier(specifier, resolveSuffix);
      return rewritten ? `import(${quote}${rewritten}${quote}` : match;
    },
  );

  // import '...' or import "..." (side-effect import)
  result = result.replace(
    /\bimport\s+(['"])(\.\.?\/[^'"]+)\1/g,
    (match, quote, specifier) => {
      const rewritten = rewriteSpecifier(specifier, resolveSuffix);
      return rewritten ? `import ${quote}${rewritten}${quote}` : match;
    },
  );

  return result;
}

/**
 * Creates a resolver that checks the filesystem to determine whether
 * a specifier targets a file (.js suffix) or directory (/index.js suffix).
 *
 * @param {string} fromDir - Absolute directory of the file being processed
 * @returns {(specifier: string) => string | null}
 */
export function createFilesystemResolver(fromDir) {
  return (specifier) => {
    const resolved = resolve(fromDir, specifier);

    // File import: ./foo.ts or ./foo.js exists → emit ./foo.js
    if (existsSync(resolved + '.ts') || existsSync(resolved + '.js')) {
      return '.js';
    }

    // Directory import: ./bar/index.ts or ./bar/index.js exists → emit ./bar/index.js
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      if (
        existsSync(resolve(resolved, 'index.ts')) ||
        existsSync(resolve(resolved, 'index.js'))
      ) {
        return '/index.js';
      }
    }

    return null;
  };
}
