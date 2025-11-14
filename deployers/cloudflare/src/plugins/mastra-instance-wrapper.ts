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

      if (!result?.code) {
        throw new Error('mastra-wrapper plugin did not return code, there is likely a bug in the plugin.');
      }

      return {
        code: result.code,
        map: result?.map,
      };
    },
  };
}
