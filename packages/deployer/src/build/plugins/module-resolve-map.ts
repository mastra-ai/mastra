import type { Plugin } from 'rollup';
import { isDependencyPartOfPackage, slash } from '../utils';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function moduleResolveMap(externals: string[], projectRoot: string): Plugin {
  const importMap = new Map<string, string>();
  return {
    name: 'module-resolve-map',
    moduleParsed(info) {
      if (info.importedIds.length === 0 || !info.id) {
        return;
      }

      for (const importedId of info.importedIds) {
        for (const external of externals) {
          if (isDependencyPartOfPackage(importedId, external)) {
            // TODO add multi version support
            importMap.set(external, info.id);
          }
        }
      }
    },

    async generateBundle(options, bundle) {
      const resolveMap = new Map<string, Map<string, string>>();

      // Iterate through all output chunks
      for (const [fileName, chunk] of Object.entries(bundle)) {
        // Only chunks have modules, assets don't
        if (chunk.type === 'chunk') {
          for (const [external, resolvedFrom] of importMap) {
            if (chunk.moduleIds.includes(resolvedFrom)) {
              const fullPath = pathToFileURL(slash(join(projectRoot, fileName))).toString();
              const innerMap = resolveMap.get(fullPath) || new Map<string, string>();
              innerMap.set(external, pathToFileURL(slash(resolvedFrom)).toString());
              resolveMap.set(fullPath, innerMap);
            }
          }
        }
      }

      // store all binaries used by a module to show in the error message
      const resolveMapJson = Object.fromEntries(
        Array.from(resolveMap.entries()).map(([key, value]) => [key, Object.fromEntries(value.entries())]),
      );

      this.emitFile({
        type: 'asset',
        name: 'module-resolve-map.json',
        source: `${JSON.stringify(resolveMapJson, null, 2)}`,
      });
    },
  } satisfies Plugin;
}
