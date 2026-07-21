import * as babel from '@babel/core';
import type { Plugin, SourceMapInput } from 'rollup';

import { removeDeployer as removeDeployerBabelPlugin } from '../babel/remove-deployer';

export function removeDeployer(mastraEntry: string, options?: { sourcemap?: boolean }): Plugin {
  return {
    name: 'remove-deployer',
    transform(code, id) {
      if (id !== mastraEntry) {
        return;
      }

      return babel
        .transformAsync(code, {
          babelrc: false,
          configFile: false,
          filename: id,
          plugins: [removeDeployerBabelPlugin],
          sourceMaps: options?.sourcemap,
        })
        .then(result => ({
          code: result!.code!,
          map: result!.map! as SourceMapInput,
        }));
    },
  } satisfies Plugin;
}
