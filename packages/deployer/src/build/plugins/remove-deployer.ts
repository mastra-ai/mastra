import { transformAsync } from '@babel/core';
import type { InputOptions } from '@babel/core';
import type { ModuleType, Plugin, SourceMapInput } from 'rolldown';

import { removeDeployer as removeDeployerBabelPlugin } from '../babel/remove-deployer';
import { exactPathRegex } from '../rolldown/filters';

type ParserPlugins = NonNullable<NonNullable<InputOptions['parserOpts']>['plugins']>;

function getParserPlugins(moduleType: ModuleType): ParserPlugins {
  switch (moduleType) {
    case 'ts':
      return ['typescript'];
    case 'tsx':
      return ['typescript', 'jsx'];
    case 'jsx':
      return ['jsx'];
    default:
      return [];
  }
}

export function removeDeployer(mastraEntry: string, options?: { sourcemap?: boolean }): Plugin {
  return {
    name: 'remove-deployer',
    transform: {
      filter: { id: exactPathRegex(mastraEntry), code: 'deployer' },
      async handler(code, id, meta) {
        // The module type is left untouched so oxc strips the types and elides the deployer import Babel orphaned.
        const result = await transformAsync(code, {
          babelrc: false,
          configFile: false,
          filename: id,
          parserOpts: { plugins: getParserPlugins(meta.moduleType) },
          plugins: [removeDeployerBabelPlugin],
          sourceMaps: options?.sourcemap,
        });

        return {
          code: result!.code!,
          map: result!.map as SourceMapInput,
        };
      },
    },
  } satisfies Plugin;
}
