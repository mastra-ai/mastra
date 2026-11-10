import { transformAsync } from '@babel/core';
import type { Plugin, SourceMapInput } from 'rollup';

import { removeDeployer as removeDeployerBabelPlugin } from '../babel/remove-deployer';
import { slash } from '../utils';

export function removeDeployer(mastraEntry: string, options?: { sourcemap?: boolean }): Plugin {
  // On Windows `#mastra` resolves to a slash-normalized id, while a relative import of the entry keeps a native one
  const normalizedEntry = slash(mastraEntry);

  return {
    name: 'remove-deployer',
    transform(code, id) {
      if (slash(id) !== normalizedEntry) {
        return;
      }

      return transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: id,
        plugins: [removeDeployerBabelPlugin],
        sourceMaps: options?.sourcemap,
      }).then(result => ({
        code: result!.code!,
        map: result!.map! as SourceMapInput,
      }));
    },
  } satisfies Plugin;
}
