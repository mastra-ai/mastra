import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import commonjs from '@rollup/plugin-commonjs';
import { removeAllOptionsExceptTelemetry } from './babel/remove-all-options-telemetry';
import { recursiveRemoveNonReferencedNodes } from './plugins/remove-unused-references';
import type { IMastraLogger } from '@mastra/core/logger';

export function getTelemetryBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
  logger: IMastraLogger,
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
                plugins: [removeAllOptionsExceptTelemetry(result, logger)],
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

export async function writeTelemetryConfig({
  entryFile,
  outputDir,
  options = {},
  logger,
}: {
  entryFile: string;
  outputDir: string;
  options: {
    sourcemap?: boolean;
  };
  logger: IMastraLogger;
}): Promise<{
  hasCustomConfig: boolean;
  externalDependencies: string[];
}> {
  const result = {
    hasCustomConfig: false,
  } as const;

  const bundle = await getTelemetryBundler(entryFile, result, logger);

  const { output } = await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
    sourcemap: options.sourcemap,
  });
  const externals = output[0].imports.filter(x => !x.startsWith('./'));

  return { ...result, externalDependencies: externals };
}
