import * as babel from '@babel/core';
import { rollup, type RollupOutput } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import commonjs from '@rollup/plugin-commonjs';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { recursiveRemoveNonReferencedNodes } from '../plugins/remove-unused-references';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import json from '@rollup/plugin-json';
import type { IMastraLogger } from '@mastra/core/logger';
import { pathToFileURL } from 'node:url';
import { removeAllOptionsFromMastraExceptPlugin } from '../plugins/remove-all-except';

import type { Config as MastraConfig } from '@mastra/core/mastra';

export function extractMastraOptionBundler(
  name: keyof MastraConfig,
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
  logger?: IMastraLogger,
) {
  return rollup({
    logLevel: 'silent',
    input: {
      [`${name}-config`]: entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      tsConfigPaths(),
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
  } as const;

  const bundler = await extractMastraOptionBundler(name, entryFile, result, logger);

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
