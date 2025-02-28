import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

import { removeAllExceptTelemetryConfig } from './babel/get-telemetry-config';
import commonjs from '@rollup/plugin-commonjs';

export async function writeTelemetryConfig(
  entryFile: string,
  outputDir: string,
): Promise<{
  hasCustomConfig: boolean;
}> {
  const result = {
    hasCustomConfig: false,
  };

  const bundle = await rollup({
    input: {
      'telemetry-config': entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      // transpile typescript to something we understand
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
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
    ],
  });

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  return result;
}
