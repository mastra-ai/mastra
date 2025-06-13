import { extname } from 'path';
import resolveFrom from 'resolve-from';
import type { Plugin } from 'rollup';

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
    resolveId(id, importer) {
      // if is relative, skip
      if (id.startsWith('.') || !importer) {
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

      try {
        // if we cannot resolve it, it means it's a legacy module
        import.meta.resolve(id);
        return null;
      } catch (e) {
        for (const ext of ['.mjs', '.js', '.cjs']) {
          const resolved = safeResolve(id + ext, importer);
          if (resolved) {
            return resolved;
          }
        }
      }

      return null;
    },
  } satisfies Plugin;
}
