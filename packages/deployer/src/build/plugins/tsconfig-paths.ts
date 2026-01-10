import fs from 'node:fs';
import path, { normalize } from 'node:path';
import resolveFrom from 'resolve-from';
import type { Plugin } from 'rollup';
import stripJsonComments from 'strip-json-comments';
import type { RegisterOptions } from 'typescript-paths';
import { createHandler } from 'typescript-paths';

const PLUGIN_NAME = 'tsconfig-paths';

export type PluginOptions = Omit<RegisterOptions, 'loggerID'> & { localResolve?: boolean };

/**
 * Check if a tsconfig file has path mappings configured.
 * Exported for testing purposes.
 *
 * @param tsConfigPath - Path to the tsconfig.json file
 * @returns true if the tsconfig has paths configured, false otherwise
 */
export function hasPaths(tsConfigPath: string): boolean {
  try {
    const content = fs.readFileSync(tsConfigPath, 'utf8');
    const config = JSON.parse(stripJsonComments(content));
    return !!(
      (config.compilerOptions?.paths && Object.keys(config.compilerOptions.paths).length > 0) ||
      config.extends
    );
  } catch {
    return false;
  }
}

export function tsConfigPaths({ tsConfigPath, respectCoreModule, localResolve }: PluginOptions = {}): Plugin {
  const handlerCache = new Map<string, ReturnType<typeof createHandler>>();

  // Find tsconfig.json file starting from a directory and walking up
  function findTsConfigForFile(filePath: string): string | null {
    let currentDir = path.dirname(filePath);
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const tsConfigPath = path.join(currentDir, 'tsconfig.json');

      if (fs.existsSync(tsConfigPath)) {
        // Check if this tsconfig has path mappings
        if (hasPaths(tsConfigPath)) {
          return tsConfigPath;
        }
      }

      // Also check for tsconfig.base.json (common in NX)
      const tsConfigBasePath = path.join(currentDir, 'tsconfig.base.json');
      if (fs.existsSync(tsConfigBasePath)) {
        if (hasPaths(tsConfigBasePath)) {
          return tsConfigBasePath;
        }
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  // Get or create handler for a specific tsconfig file
  function getHandlerForFile(filePath: string): ReturnType<typeof createHandler> | null {
    // If a specific tsConfigPath was provided, use it
    if (tsConfigPath && typeof tsConfigPath === 'string') {
      if (!handlerCache.has(tsConfigPath)) {
        handlerCache.set(
          tsConfigPath,
          createHandler({
            log: () => {},
            tsConfigPath,
            respectCoreModule,
            falllback: moduleName => fs.existsSync(moduleName),
          }),
        );
      }
      return handlerCache.get(tsConfigPath)!;
    }

    // Find appropriate tsconfig for this file
    const configPath = findTsConfigForFile(filePath);
    if (!configPath) {
      return null;
    }

    // Cache handlers to avoid recreation
    if (!handlerCache.has(configPath)) {
      handlerCache.set(
        configPath,
        createHandler({
          log: () => {},
          tsConfigPath: configPath,
          respectCoreModule,
          falllback: moduleName => fs.existsSync(moduleName),
        }),
      );
    }

    return handlerCache.get(configPath)!;
  }

  // Simple alias resolution using dynamic handler
  function resolveAlias(request: string, importer: string): string | null | undefined {
    // Get the appropriate handler for this file
    const dynamicHandler = getHandlerForFile(importer);
    if (!dynamicHandler) {
      return null;
    }

    const resolved = dynamicHandler(request, normalize(importer));
    return resolved;
  }

  return {
    name: PLUGIN_NAME,
    async resolveId(request, importer, options) {
      if (!importer || request.startsWith('\0') || importer.charCodeAt(0) === 0) {
        return null;
      }

      const moduleName = resolveAlias(request, importer);
      // No tsconfig alias found, so we need to resolve it normally
      if (!moduleName) {
        let importerMeta: { [PLUGIN_NAME]?: { resolved?: boolean } } = {};

        const resolved = await this.resolve(request, importer, { skipSelf: true, ...options });
        if (!resolved) {
          return null;
        }

        // If localResolve is true, we need to check if the importer has been resolved by the tsconfig-paths plugin
        // if so, we need to resolve the request from the importer instead of the root and mark it as external
        if (localResolve) {
          const importerInfo = this.getModuleInfo(importer);
          importerMeta = importerInfo?.meta || {};

          if (!request.startsWith('./') && !request.startsWith('../') && importerMeta?.[PLUGIN_NAME]?.resolved) {
            return {
              ...resolved,
              external: !request.startsWith('hono/') && request !== 'hono',
            };
          }
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

      // Always pass through bundler's resolution to ensure proper path normalization
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
    },
  } satisfies Plugin;
}
