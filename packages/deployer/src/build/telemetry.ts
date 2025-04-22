import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import commonjs from '@rollup/plugin-commonjs';
import { removeAllOptionsExceptTelemetry } from './babel/remove-all-options-telemetry';
import { recursiveRemoveNonReferencedNodes } from './plugins/remove-unused-references';

export async function getTelemetryBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  const externalDependencies = new Set<string>();

  const bundle = await rollup({
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
                plugins: [removeAllOptionsExceptTelemetry(result)],
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
      {
        name: 'get-external-deps',
        async resolveId(source) {
          const resolved = await this.resolve(source);
          if (!resolved && !externalDependencies.has(source)) {
            externalDependencies.add(source);
          }
          return null;
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

  return { bundle, externalDependencies };
}

export async function writeTelemetryConfig(
  entryFile: string,
  outputDir: string,
): Promise<{
  hasCustomConfig: boolean;
  externalDependencies: Set<string>;
}> {
  const result = {
    hasCustomConfig: false,
  } as const;

  const { bundle, externalDependencies } = await getTelemetryBundler(entryFile, result);

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  return { ...result, externalDependencies };
}
