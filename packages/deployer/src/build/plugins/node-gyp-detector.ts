import type { Plugin } from 'rollup';
import { getPackageInfo } from 'local-pkg';

export function nodeGypDetector(): Plugin {
  const modulesToTrack = new Set<string>();
  const modulesToTrackPackageInfo = new Map<string, ReturnType<typeof getPackageInfo>>();

  return {
    name: 'node-gyp-build-detector',
    moduleParsed(info) {
      if (!info.meta?.commonjs?.requires?.length) {
        return;
      }

      const hasNodeGypBuild = info.meta.commonjs.requires.some((m: { resolved?: { id: string } }) =>
        m?.resolved?.id.endsWith('node-gyp-build/index.js'),
      );
      if (!hasNodeGypBuild) {
        return;
      }

      modulesToTrack.add(info.id);
      modulesToTrackPackageInfo.set(info.id, getPackageInfo(info.id));
    },

    async generateBundle(options, bundle) {
      const binaryMapByChunk = new Map<string, Set<string>>();
      // Iterate through all output chunks
      for (const [fileName, chunk] of Object.entries(bundle)) {
        // Only chunks have modules, assets don't
        if (chunk.type === 'chunk') {
          for (const moduleId of chunk.moduleIds) {
            if (modulesToTrackPackageInfo.has(moduleId)) {
              const pkgInfo = await modulesToTrackPackageInfo.get(moduleId)!;

              if (!binaryMapByChunk.has(fileName)) {
                binaryMapByChunk.set(fileName, new Set());
              }

              if (pkgInfo?.packageJson?.name) {
                binaryMapByChunk.get(fileName)!.add(pkgInfo.packageJson.name);
              }
            }
          }
        }
      }

      const binaryMapJson = Object.fromEntries(
        Array.from(binaryMapByChunk.entries()).map(([key, value]) => [key, Array.from(value)]),
      );

      // store all binaries used by a module to show in the error message
      this.emitFile({
        type: 'asset',
        name: 'binary-map.json',
        source: `${JSON.stringify(binaryMapJson, null, 2)}`,
      });
    },
  } satisfies Plugin;
}
