import * as babel from '@babel/core';
import type { Plugin } from 'rollup';

import { removeDeployer as removeDeployerBabelPlugin } from '../babel/remove-deployer';

export function removeDeployer(mastraEntry: string): Plugin {
  return {
    name: 'remove-deployer',
    transform(code, id) {
      if (id !== mastraEntry) {
        return;
      }

      return new Promise((resolve, reject) => {
        babel.transform(
          code,
          {
            babelrc: false,
            configFile: false,
            filename: id,
            plugins: [removeDeployerBabelPlugin],
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
  } satisfies Plugin;
}
