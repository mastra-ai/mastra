import { transformAsync } from '@babel/core';
import type { IMastraLogger } from '@internal/core/logger';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import type { Plugin } from 'rolldown';
import { transformSync } from 'rolldown/utils';
import { removeAllOptionsFromMastraExcept } from '../babel/remove-all-options-except';
import { exactPathRegex } from '../rolldown';
import { recursiveRemoveNonReferencedNodes } from './remove-unused-references';

/**
 * Rewrites the Mastra entry so it only exports the `name` option and what it references.
 *
 * Transform hooks receive raw TS/JSX, so the entry is transpiled first: Babel can't parse it, and the cleanup pass
 * would drop runtime TS constructs such as enums. The result is plain JS, so oxc doesn't transpile it again.
 */
export function removeAllOptionsFromMastraExceptPlugin(
  mastraEntry: string,
  name: keyof MastraConfig,
  result: { hasCustomConfig: boolean },
  options?: { logger?: IMastraLogger },
): Plugin {
  return {
    name: `remove-${name}`,
    transform: {
      filter: { id: exactPathRegex(mastraEntry) },
      async handler(code, id, { moduleType }) {
        if (moduleType === 'ts' || moduleType === 'tsx' || moduleType === 'jsx') {
          const transpiled = transformSync(id, code, { lang: moduleType, tsconfig: true });
          if (transpiled.errors.length) {
            throw transpiled.errors[0];
          }
          code = transpiled.code;
        }

        const extracted = await transformAsync(code, {
          babelrc: false,
          configFile: false,
          filename: id,
          plugins: [() => removeAllOptionsFromMastraExcept(result, name, options?.logger)],
        });

        const cleaned = await recursiveRemoveNonReferencedNodes(extracted!.code!);

        return { code: cleaned.code, moduleType: 'js' };
      },
    },
  };
}
