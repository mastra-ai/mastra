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

      const moduleName = handler?.(request, normalize(importer));
      // No tsconfig alias found, so we need to resolve it normally
      if (!moduleName) {
        let importerMeta: { [PLUGIN_NAME]?: { resolved?: boolean } } = {};

        // If localResolve is true, we need to check if the importer has been resolved by the tsconfig-paths plugin
        // if so, we need to resolve the request from the importer instead of the root and mark it as external
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

      // When a module does not have an extension, we need to resolve it to a file
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
