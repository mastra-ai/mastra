import * as babel from '@babel/core';
import type { MastraDeployer } from '@mastra/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

import { removeAllExceptDeployer } from './babel/get-deployer';
import { FileService } from './fs';

export async function getDeployer(mastraPath: string, outputDir: string) {
  const fs = new FileService();
  const file = fs.getFirstExistingFile([`${mastraPath}/index.ts`, `${mastraPath}/index.js`]);

  const bundle = await rollup({
    input: {
      deployer: file,
    },
    treeshake: true,
    plugins: [
      // transpile typescript to something we understand
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
      }),
      {
        name: 'get-deployer',
        transform(code, id) {
          if (!this.getModuleInfo(id)?.isEntry) {
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

  await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  return (await import(`file:${outputDir}/deployer.mjs`)).deployer as unknown as MastraDeployer;
}
