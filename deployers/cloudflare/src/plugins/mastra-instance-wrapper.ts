import { transformSync } from '@babel/core';
import type { Plugin } from 'rollup';
import { mastraInstanceWrapper as mastraInstanceWrapperBabel } from '../babel/mastra-instance-wrapper';

export function mastraInstanceWrapper(mastraEntryFile: string): Plugin {
  return {
    name: 'mastra-wrapper',
    transform(code, id) {
      if (id !== mastraEntryFile) {
        return null;
      }

      const result = transformSync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        plugins: [mastraInstanceWrapperBabel],
      });

      return {
        code: result?.code || code,
        map: result?.map,
      };
    },
  };
}
