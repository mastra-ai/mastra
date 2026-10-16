import { transformAsync } from '@babel/core';
import type { Plugin, SourceMapInput } from 'rollup';

import { extractToolUI as extractToolUIBabelPlugin } from '../babel/extract-tool-ui';
import type { ExtractedToolUIComponent } from '../babel/extract-tool-ui';

export type ToolUIRegistry = Map<string, ExtractedToolUIComponent>;

/**
 * Strips `ui.studioComponent` imports from tool modules and records them in `registry`
 * so they can be bundled separately for Studio.
 */
export function extractToolUI({
  registry = new Map(),
  sourcemap,
  onWarning,
}: {
  registry?: ToolUIRegistry;
  sourcemap?: boolean;
  onWarning?: (message: string) => void;
} = {}): Plugin {
  return {
    name: 'extract-tool-ui',
    async transform(code, id) {
      if (!code.includes('studioComponent') || id.startsWith('\0')) {
        return;
      }

      let changed = false;
      const result = await transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: id,
        sourceMaps: sourcemap,
        plugins: [
          () =>
            extractToolUIBabelPlugin({
              onComponent: component => {
                changed = true;
                registry.set(component.id, component);
              },
              onWarning,
            }),
        ],
      });

      if (!changed) {
        return;
      }

      return {
        code: result!.code!,
        map: result!.map as SourceMapInput,
      };
    },
  } satisfies Plugin;
}
