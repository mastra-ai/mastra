import fs from 'node:fs';
import path, { normalize } from 'node:path';
import type { Plugin } from 'rollup';
import type { RegisterOptions } from 'typescript-paths';
import { createHandler } from 'typescript-paths';

const PLUGIN_NAME = 'tsconfig-paths';

export type PluginOptions = Omit<RegisterOptions, 'loggerID'>;

export function tsConfigPaths({ tsConfigPath, respectCoreModule }: PluginOptions = {}): Plugin {
  let handler: ReturnType<typeof createHandler>;
  return {
    name: PLUGIN_NAME,
    buildStart() {
      handler = createHandler({
        log: () => {},
        tsConfigPath,
        respectCoreModule,
        falllback: moduleName => fs.existsSync(moduleName),
      });
      return;
    },
    async resolveId(request, importer, options) {
      if (!importer || request.startsWith('\0')) {
        return null;
      }

      const moduleName = handler?.(request, normalize(importer));
      if (!moduleName) {
        return this.resolve(request, importer, { skipSelf: true, ...options });
      }

      if (!path.extname(moduleName)) {
        return this.resolve(moduleName, importer, { skipSelf: true, ...options });
      }

      return moduleName;
    },
  } satisfies Plugin;
}
