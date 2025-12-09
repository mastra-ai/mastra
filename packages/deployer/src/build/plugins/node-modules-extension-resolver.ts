import { dirname, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import resolveFrom from 'resolve-from';
import type { Plugin } from 'rollup';
import { builtinModules } from 'node:module';
import nodeResolve from '@rollup/plugin-node-resolve';
import { getPackageName } from '../utils';

/**
 * Check if a module is a Node.js builtin module
 * @param specifier - Module specifier
 * @returns True if it's a builtin module
 */
function isBuiltinModule(specifier: string): boolean {
  return (
    builtinModules.includes(specifier) ||
    specifier.startsWith('node:') ||
    builtinModules.includes(specifier.replace(/^node:/, ''))
  );
}

function safeResolve(id: string, importer: string) {
  try {
    return resolveFrom(importer, id);
  } catch {
    return null;
  }
}

// we only need this for dev, so we can resolve the js extension of the module as we do not use node-resolve
export function nodeModulesExtensionResolver(): Plugin {
  return {
    name: 'node-modules-extension-resolver',
    async resolveId(id, importer, options) {
      // if is relative, skip
      if (id.startsWith('.') || id.startsWith('/') || !importer) {
        return null;
      }

      if (isBuiltinModule(id)) {
        return null;
      }

      // if it's a scoped direct import skip
      if (id.startsWith('@') && id.split('/').length === 2) {
        return null;
      }

      // if it's a direct import, skip
      if (!id.startsWith('@') && id.split('/').length === 1) {
        return null;
      }

      const foundExt = extname(id);
      if (foundExt) {
        return null;
      }

        // if we cannot resolve it, it means it's a legacy module
        // @ts-expect-error - todo
        const nodeResolved = await nodeResolve().resolveId.handler.bind(this)(id, importer, options)
        if (!nodeResolved?.resolvedBy) {
          return null
        } else {
        // try to do a node like resolve first
        const resolved = safeResolve(id, importer);
        if (resolved) {
          const pkgName = getPackageName(id);
          if (!pkgName) {
            return null;
          }

          const pkgJsonPath = safeResolve(`${pkgName}/package.json`, importer);
          if (!pkgJsonPath) {
            return null;
          }

          const newImportWithExtension = resolved.replace(dirname(pkgJsonPath), pkgName);

          const test = pathToFileURL(newImportWithExtension).href
          // console.log(`${resolved} - ${id} - ${test} - ${importer} - ${newImportWithExtension}`);
          return {
            id: newImportWithExtension,
            external: true,
          };
        }

        for (const ext of ['.mjs', '.js', '.cjs']) {
          const resolved = safeResolve(id + ext, importer);
          if (resolved) {
            const pkgName = getPackageName(id);
            if (!pkgName) {
              return null;
            }

            const pkgJsonPath = safeResolve(`${pkgName}/package.json`, importer);
            if (!pkgJsonPath) {
              return null;
            }

            const newImportWithExtension = resolved.replace(dirname(pkgJsonPath), pkgName);

            return {
              id: newImportWithExtension,
              external: true,
            };
          }
        }
        }

      return null;
    },
  } satisfies Plugin;
}
