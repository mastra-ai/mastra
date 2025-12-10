import { dirname, extname } from 'node:path';
import resolveFrom from 'resolve-from';
import type { PartialResolvedId, Plugin } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import { getPackageName, isBuiltinModule } from '../utils';

function safeResolve(id: string, importer: string) {
  try {
    return resolveFrom(importer, id);
  } catch {
    return null;
  }
}

/**
 * We need this for dev & externalsPreset, so we can resolve the js extension of the module as we do not use node-resolve
 */
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

      // The node-resolve plugin should handle most cases
      // @ts-expect-error - Needs type casting
      const nodeResolved: PartialResolvedId | null | undefined = await nodeResolve().resolveId.handler.call(
        this,
        id,
        importer,
        options,
      );

      if (!nodeResolved?.resolvedBy) {
        return null;
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
