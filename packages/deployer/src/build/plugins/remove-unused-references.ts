import * as babel from '@babel/core';
import { removeNonReferencedNodes } from '../babel/remove-non-referenced-nodes';

export function recursiveRemoveNonReferencedNodes(code: string) {
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
