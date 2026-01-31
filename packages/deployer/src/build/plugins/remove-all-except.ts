import * as babel from '@babel/core';
import type { Plugin } from 'rollup';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import { removeAllOptionsFromMastraExcept } from '../babel/remove-all-options-except';
import type { IMastraLogger } from '@mastra/core/logger';

export function removeAllOptionsFromMastraExceptPlugin(
  mastraEntry: string,
  name: keyof MastraConfig,
  result: { hasCustomConfig: boolean },
  options?: { sourcemap?: boolean; logger?: IMastraLogger },
): Plugin {
  return {
    name: `remove-${name}`,
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
            plugins: [removeAllOptionsFromMastraExcept(result, name, options?.logger)],
            sourceMaps: options?.sourcemap,
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
