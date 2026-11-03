import { transformSync } from '@babel/core';
import { exactPathRegex } from '@mastra/deployer/build';
import type { Plugin, SourceMapInput } from 'rolldown';
import { mastraInstanceWrapper as mastraInstanceWrapperBabel } from '../babel/mastra-instance-wrapper';
import { getBabelParserPlugins } from './babel-parser-plugins';

export function mastraInstanceWrapper(mastraEntryFile: string): Plugin {
  return {
    name: 'mastra-wrapper',
    transform: {
      filter: { id: exactPathRegex(mastraEntryFile) },
      handler(code, id, meta) {
        // The module type is kept so oxc still strips the types after this hook.
        const result = transformSync(code, {
          filename: id,
          babelrc: false,
          configFile: false,
          parserOpts: { plugins: getBabelParserPlugins(meta.moduleType) },
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
    },
  };
}
