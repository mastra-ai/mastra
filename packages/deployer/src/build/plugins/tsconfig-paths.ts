import fs from 'node:fs';
import path, { normalize } from 'node:path';
import resolveFrom from 'resolve-from';
import type { Plugin } from 'rollup';
import type { RegisterOptions } from 'typescript-paths';
import { createHandler } from 'typescript-paths';

const PLUGIN_NAME = 'tsconfig-paths';

export type PluginOptions = Omit<RegisterOptions, 'loggerID'> & { localResolve?: boolean };

export function tsConfigPaths({ tsConfigPath, respectCoreModule, localResolve }: PluginOptions = {}): Plugin {
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

      let importerMeta: { [PLUGIN_NAME]?: { resolved?: boolean } } = {};
      if (localResolve) {
        const importerInfo = this.getModuleInfo(importer);

        importerMeta = importerInfo?.meta || {};

        if (!request.startsWith('./') && !request.startsWith('../') && importerMeta?.[PLUGIN_NAME]?.resolved) {
          return {
            id: resolveFrom(importer, request) ?? null,
            external: true,
          };
        }
      }

      const moduleName = handler?.(request, normalize(importer));
      if (!moduleName) {
        const resolved = await this.resolve(request, importer, { skipSelf: true, ...options });

        if (!resolved) {
          return null;
        }

        return {
          ...resolved,
          meta: {
            ...(resolved.meta || {}),
            ...importerMeta,
          },
        };
      }

      if (!path.extname(moduleName)) {
        const resolved = await this.resolve(moduleName, importer, { skipSelf: true, ...options });

        if (!resolved) {
          return null;
        }

        return {
          ...resolved,
          meta: {
            ...resolved.meta,
            [PLUGIN_NAME]: {
              resolved: true,
            },
          },
        };
      }

      return {
        id: moduleName,
        meta: {
          [PLUGIN_NAME]: {
            resolved: true,
          },
        },
      };
    },
  } satisfies Plugin;
}
