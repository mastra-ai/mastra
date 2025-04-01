import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

import { removeAllOptionsExceptServer } from './babel/remove-all-options-server';
import commonjs from '@rollup/plugin-commonjs';
import { recursiveRemoveNonReferencedNodes } from './plugins/remove-unused-references';
import type { Config, Mastra } from '@mastra/core';

export function getServerOptionsBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return rollup({
    logLevel: 'silent',
    input: {
      'server-config': entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      // transpile typescript to something we understand
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
      }),
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      {
        name: 'get-server-config',
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
                plugins: [removeAllOptionsExceptServer(result)],
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

export async function getServerOptions(entryFile: string, outputDir: string): Promise<Config['server'] | null> {
  const result = {
    hasCustomConfig: false,
  } as const;

  const bundle = await getServerOptionsBundler(entryFile, result);

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  if (result.hasCustomConfig) {
    return (await import(`file:${outputDir}/server-config.mjs`)).server as unknown as Config['server'];
  }

  return null;
}
