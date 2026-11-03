import type { Plugin } from 'rolldown';
import { getPackageInfo } from '../package-info';
import { slash } from '../utils';

/**
 * Emits `binary-map.json` (chunk fileName -> names of packages in that chunk that load native addons through
 * `node-gyp-build`), used to point at the right package when a binary fails to load at runtime.
 */
export function nodeGypDetector(): Plugin {
  return {
    name: 'node-gyp-build-detector',
    async generateBundle(_options, bundle) {
      const chunkByModuleId = new Map<string, string>();
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') {
          continue;
        }
        for (const moduleId of chunk.moduleIds) {
          chunkByModuleId.set(moduleId, fileName);
        }
      }

      const binaryMapByChunk = new Map<string, Set<string>>();
      for (const moduleId of chunkByModuleId.keys()) {
        if (!slash(moduleId).endsWith('/node-gyp-build/index.js')) {
          continue;
        }

        for (const importer of this.getModuleInfo(moduleId)?.importers ?? []) {
          // Importers that were tree-shaken away are not part of any chunk.
          const fileName = chunkByModuleId.get(importer);
          if (!fileName) {
            continue;
          }

          let packageNames = binaryMapByChunk.get(fileName);
          if (!packageNames) {
            packageNames = new Set();
            binaryMapByChunk.set(fileName, packageNames);
          }

          const pkgInfo = await getPackageInfo(importer);
          if (pkgInfo?.packageJson?.name) {
            packageNames.add(pkgInfo.packageJson.name);
          }
        }
      }

      const binaryMapJson = Object.fromEntries(
        Array.from(binaryMapByChunk.entries()).map(([key, value]) => [key, Array.from(value)]),
      );

      this.emitFile({
        type: 'asset',
        name: 'binary-map.json',
        source: JSON.stringify(binaryMapJson, null, 2),
      });
    },
  } satisfies Plugin;
}
