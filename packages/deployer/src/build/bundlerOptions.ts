import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import commonjs from '@rollup/plugin-commonjs';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { removeAllOptionsExceptBundler } from './babel/remove-all-options-bundler';
import { recursiveRemoveNonReferencedNodes } from './plugins/remove-unused-references';
import type { Config } from '@mastra/core';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';

export function getBundlerOptionsBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return rollup({
    logLevel: 'silent',
    input: {
      'bundler-config': entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      tsConfigPaths(),
      // transpile typescript to something we understand
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
      }),
      optimizeLodashImports(),
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      {
        name: 'get-bundler-config',
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
                plugins: [removeAllOptionsExceptBundler(result)],
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
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
      }),
      {
        name: 'cleanup',
        transform(code, id) {
          if (id !== entryFile) {
            return;
          }

          return recursiveRemoveNonReferencedNodes(code);
        },
      },
      // let esbuild remove all unused imports
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
      }),
    ],
  });
}

export async function getBundlerOptions(entryFile: string, outputDir: string): Promise<Config['bundler'] | null> {
  const result = {
    hasCustomConfig: false,
  } as const;
  const bundle = await getBundlerOptionsBundler(entryFile, result);

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  if (result.hasCustomConfig) {
    return (await import(`file:${outputDir}/bundler-config.mjs`)).bundler as unknown as Config['bundler'];
  }

  return null;
}
