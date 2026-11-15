import { transformSync } from '@babel/core';
import type { Plugin, SourceMapInput } from 'rollup';
import { mastraInstanceWrapper as mastraInstanceWrapperBabel } from '../babel/mastra-instance-wrapper';

export function mastraInstanceWrapper(mastraEntryFile: string): Plugin {
  // On Windows `#mastra` resolves to a slash-normalized id, while `mastraEntryFile` is native
  const normalizedEntry = mastraEntryFile.replaceAll('\\', '/');

  return {
    name: 'mastra-wrapper',
    transform(code, id) {
      if (id.replaceAll('\\', '/') !== normalizedEntry) {
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
        map: result?.map as SourceMapInput | undefined,
      };
    },
  };
}
