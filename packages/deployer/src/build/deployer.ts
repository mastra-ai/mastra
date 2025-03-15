import * as babel from '@babel/core';
import type { MastraDeployer } from '@mastra/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

import { removeAllExceptDeployer } from './babel/get-deployer';
import commonjs from '@rollup/plugin-commonjs';

export function getDeployerBundler(entryFile: string) {
  return rollup({
    logLevel: 'silent',
    input: {
      deployer: entryFile,
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
        name: 'get-deployer',
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
                plugins: [removeAllExceptDeployer],
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
}

export async function getDeployer(entryFile: string, outputDir: string) {
  const bundle = await getDeployerBundler(entryFile);

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  return (await import(`file:${outputDir}/deployer.mjs`)).deployer as unknown as MastraDeployer;
}
