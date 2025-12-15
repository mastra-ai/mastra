import { dirname, extname } from 'node:path';
import { readFileSync } from 'node:fs';
import resolveFrom from 'resolve-from';
import type { Plugin } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import { getPackageName, isBuiltinModule } from '../utils';

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

const packageExportsCache = new Map<string, boolean>();
const resolveCache = new Map<string, string | null>();

function safeResolve(id: string, importer: string): string | null {
  const cacheKey = `${id}\0${importer}`;
  const cached = resolveCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  let result: string | null;
  try {
    result = resolveFrom(importer, id);
  } catch {
    result = null;
  }
  resolveCache.set(cacheKey, result);
  return result;
}

/**
 * Check if a package has an exports field in its package.json.
 * Results are cached to avoid repeated filesystem reads.
 */
function packageHasExports(pkgName: string, importer: string): boolean {
  const pkgMainPath = safeResolve(pkgName, importer);
  if (!pkgMainPath) return false;
  // Find package.json and cache by its directory
  let dir = pkgMainPath;
  for (let i = 0; i < 10; i++) {
    dir = dirname(dir);
    const cached = packageExportsCache.get(dir);
    if (cached !== undefined) return cached;

    try {
      const pkgJson = JSON.parse(readFileSync(`${dir}/package.json`, 'utf-8'));
      if (pkgJson.name === pkgName) {
        const result = !!pkgJson.exports;
        packageExportsCache.set(dir, result);
        return result;
      }
    } catch {
      // continue up
    }
  }
  return false;
}

/**
 * Rollup plugin that resolves module extensions for external dependencies.
 *
 * This plugin handles ESM compatibility for external imports when node-resolve is not used:
 * - Packages WITH exports field (e.g., hono, date-fns): Keep imports as-is or strip redundant extensions
 * - Packages WITHOUT exports field (e.g., lodash): Add .js extension for direct file imports
 */
export function nodeModulesExtensionResolver(): Plugin {
  // Create a single instance of node-resolve to reuse
  const nodeResolvePlugin = nodeResolve();

  return {
    name: 'node-modules-extension-resolver',
    async resolveId(id, importer, options) {
      // Skip relative imports, absolute paths, no importer, or builtin modules
      if (!importer || id.startsWith('.') || id.startsWith('/') || isBuiltinModule(id)) {
        return null;
      }

      // Skip direct package imports (e.g., 'lodash', '@mastra/core')
      const parts = id.split('/');
      const isScoped = id.startsWith('@');
      if ((isScoped && parts.length === 2) || (!isScoped && parts.length === 1)) {
        return null;
      }

      const foundExt = extname(id);
      const pkgName = getPackageName(id);

      // Handle imports that already have a JS extension
      if (foundExt && JS_EXTENSIONS.has(foundExt)) {
        // If package has exports, strip the extension to avoid double-extension issues
        // (e.g., hono/utils/mime.js -> hono/dist/utils/mime.js.js)
        if (pkgName && packageHasExports(pkgName, importer)) {
          return {
            id: id.slice(0, -foundExt.length),
            external: true,
          };
        }
        // For packages without exports, keep the extension as-is
        return { id, external: true };
      }

      // Try import.meta.resolve first - if it works, the import is valid as-is
      // This respects ESM exports maps correctly
      try {
        const resolved = import.meta.resolve(id);
        if (resolved && extname(resolved)) {
          return { id, external: true };
        }
      } catch {
        // import.meta.resolve failed, continue with fallback logic
      }

      // Fallback: For imports without extension, check if we need to add one
      // @ts-expect-error - resolveId.handler exists but isn't typed
      const nodeResolved = await nodeResolvePlugin.resolveId?.handler?.call(this, id, importer, options);

      if (!nodeResolved?.id) {
        return null;
      }

      const resolved = safeResolve(id, importer);
      if (!resolved) {
        // Try adding extensions manually
        for (const ext of JS_EXTENSIONS) {
          if (safeResolve(id + ext, importer)) {
            return { id: id + ext, external: true };
          }
        }
        return null;
      }

      const resolvedExt = extname(resolved);

      // No JS extension in resolved path - keep as-is
      if (!resolvedExt || !JS_EXTENSIONS.has(resolvedExt)) {
        return { id, external: true };
      }

      // Package has exports - let Node.js resolve via exports map
      if (pkgName && packageHasExports(pkgName, importer)) {
        return { id, external: true };
      }

      // Check if this is a direct file reference that needs the extension
      // e.g., lodash/fp/get resolves to .../lodash/fp/get.js
      const subpath = pkgName ? id.slice(pkgName.length + 1) : '';
      if (subpath && resolved.endsWith(`/${subpath}${resolvedExt}`)) {
        return { id: id + resolvedExt, external: true };
      }

      return { id, external: true };
    },
  };
}
