import * as babel from '@babel/core';
import { rollup, type RollupOutput } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import commonjs from '@rollup/plugin-commonjs';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { recursiveRemoveNonReferencedNodes } from '../plugins/remove-unused-references';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import { removeAllOptionsFromMastraExcept } from '../babel/remove-all-options-except';
import json from '@rollup/plugin-json';
import type { IMastraLogger } from '@mastra/core/logger';

type Transformer = (
  result: { hasCustomConfig: boolean },
  logger?: IMastraLogger,
) => ReturnType<typeof removeAllOptionsFromMastraExcept>;

export function extractMastraOptionBundler(
  name: string,
  entryFile: string,
  transformer: Transformer,
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
      optimizeLodashImports(),
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      json(),
      {
        name: `extract-${name}-config`,
        transform(code, id) {
          if (id !== entryFile) {
            return;
          }

          return new Promise((resolve, reject) => {
            babel.transform(
              code,
              {
                babelrc: false,
                configFile: false,
                filename: id,
                plugins: [transformer(result, logger)],
              },
              (err, result) => {
                if (err) {
                  return reject(err);
                }

                resolve({
                  code: result!.code!,
                  map: result!.map!,
                });
              },
            );
          });
        },
      },
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

export async function extractMastraOption<T>(
  name: string,
  entryFile: string,
  transformer: Transformer,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<{
  bundleOutput: RollupOutput;
  getConfig: () => Promise<T>;
} | null> {
  const result = {
    hasCustomConfig: false,
  } as const;
  const bundler = await extractMastraOptionBundler(name, entryFile, transformer, result, logger);

  const output = await bundler.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  if (result.hasCustomConfig) {
    const configPath = `${outputDir}/${name}-config.mjs`;

    return {
      bundleOutput: output,
      getConfig: () => import(`file:${configPath}`).then(m => m[name] as T),
    };
  }

  return null;
}
