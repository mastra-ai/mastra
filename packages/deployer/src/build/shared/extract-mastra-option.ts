import * as babel from '@babel/core';
import { rollup, type RollupOutput } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { recursiveRemoveNonReferencedNodes } from '../plugins/remove-unused-references';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import json from '@rollup/plugin-json';
import type { IMastraLogger } from '@mastra/core/logger';
import { pathToFileURL } from 'node:url';
import { removeAllOptionsFromMastraExceptPlugin } from '../plugins/remove-all-except';
import { getWorkspaceInformation } from '../../bundler/workspaceDependencies';
import { getPackageName } from '../utils';

import type { Config as MastraConfig } from '@mastra/core/mastra';

export function extractMastraOptionBundler(
  name: keyof MastraConfig,
  entryFile: string,
  result: {
    hasCustomConfig: boolean;
  },
  logger?: IMastraLogger,
  options?: { workspacePackages?: Set<string> },
) {
  const workspacePackages = options?.workspacePackages ?? new Set<string>();
  const nodeResolvePlugin = nodeResolve({ preferBuiltins: true });

  return rollup({
    logLevel: 'silent',
    input: {
      [`${name}-config`]: entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      tsConfigPaths(),
      // Resolve workspace packages so they get bundled (not kept as external)
      {
        name: 'workspace-resolver',
        async resolveId(id, importer, resolveOptions) {
          if (!importer) return null;
          const pkgName = getPackageName(id);
          if (pkgName && workspacePackages.has(pkgName)) {
            // @ts-expect-error - handler is part of resolveId signature
            const resolved = await nodeResolvePlugin.resolveId?.handler?.call(this, id, importer, resolveOptions);
            if (resolved?.id) {
              return { id: resolved.id, external: false };
            }
          }
          return null;
        },
      },
      // transpile typescript to something we understand
      esbuild(),
      optimizeLodashImports({
        include: '**/*.{js,ts,mjs,cjs}',
      }),
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      json(),
      removeAllOptionsFromMastraExceptPlugin(entryFile, name, result, { logger }),
      // let esbuild remove all unused imports
      esbuild(),
      {
        name: 'cleanup',
        transform(code, id) {
          if (id !== entryFile) {
            return;
          }

          return recursiveRemoveNonReferencedNodes(code);
        },
      },
      // let esbuild remove it once more
      esbuild(),
    ],
  });
}

export async function extractMastraOption<T extends keyof MastraConfig>(
  name: T,
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<{
  bundleOutput: RollupOutput;
  getConfig: () => Promise<MastraConfig[T]>;
} | null> {
  const result = {
    hasCustomConfig: false,
  };

  // Get workspace packages so they can be bundled instead of kept external
  const { workspaceMap } = await getWorkspaceInformation({ mastraEntryFile: entryFile });
  const workspacePackages = new Set(workspaceMap.keys());

  const bundler = await extractMastraOptionBundler(name, entryFile, result, logger, { workspacePackages });

  const output = await bundler.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  if (result.hasCustomConfig) {
    const configPath = `${outputDir}/${name}-config.mjs`;

    return {
      bundleOutput: output,
      getConfig: () => import(pathToFileURL(configPath).href).then(m => m[name] as MastraConfig[T]),
    };
  }

  return null;
}
