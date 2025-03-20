import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

import { removeAllExceptTelemetryConfig } from './babel/get-telemetry-config';
import commonjs from '@rollup/plugin-commonjs';
import { removeNonReferencedNodes } from './babel/remove-non-referenced-nodes';

function recursiveRemoveNonReferencedNodes(code: string) {
  return new Promise<{ code: string; map: any }>(async (resolve, reject) => {
    babel.transform(
      code,
      {
        babelrc: false,
        configFile: false,
        plugins: [removeNonReferencedNodes()],
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }

        // keep looping until the code is not changed
        if (result && result.code! !== code) {
          return recursiveRemoveNonReferencedNodes(result!.code!).then(resolve, reject);
        }

        resolve({
          code: result!.code!,
          map: result!.map!,
        });
      },
    );
  });
}

export function getTelemetryBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return rollup({
    logLevel: 'silent',
    input: {
      'telemetry-config': entryFile,
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
        name: 'get-telemetry-config',
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
                plugins: [removeAllExceptTelemetryConfig(result)],
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

export async function writeTelemetryConfig(
  entryFile: string,
  outputDir: string,
): Promise<{
  hasCustomConfig: boolean;
}> {
  const result = {
    hasCustomConfig: false,
  } as const;

  const bundle = await getTelemetryBundler(entryFile, result);

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  return result;
}
