import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { createPathsMatcher, parseTsconfig } from 'get-tsconfig';
import type { PathsMatcher } from 'get-tsconfig';
import type { Plugin } from 'rollup';

const PLUGIN_NAME = 'tsconfig-paths';
const JS_IMPORT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const CORE_MODULES = new Set([...builtinModules, ...builtinModules.map(moduleName => `node:${moduleName}`)]);

export type PluginOptions = {
  tsConfigPath?: string;
  respectCoreModule?: boolean;
  localResolve?: boolean;
  cwd?: string;
};

/**
 * Check if a tsconfig file has path mappings configured.
 * Exported for testing purposes.
 *
 * @param tsConfigPath - Path to the tsconfig.json file
 * @returns true if the tsconfig has paths configured or extends another config, false otherwise
 */
export function hasPaths(tsConfigPath: string): boolean {
  try {
    const paths = parseTsconfig(tsConfigPath).compilerOptions?.paths;
    return !!paths && Object.keys(paths).length > 0;
  } catch {
    return false;
  }
}

export function tsConfigPaths({
  tsConfigPath,
  respectCoreModule = true,
  localResolve,
  cwd,
}: PluginOptions = {}): Plugin {
  const matcherCache = new Map<string, { matcher: PathsMatcher | null; patterns: string[] } | null>();

  function resolveImportToSourceFile(moduleName: string): string {
    if (fs.existsSync(moduleName) && fs.statSync(moduleName).isFile()) {
      return moduleName;
    }

    const parsed = path.parse(moduleName);
    const candidates =
      parsed.ext === '.js'
        ? JS_IMPORT_SOURCE_EXTENSIONS.map(extension => path.join(parsed.dir, `${parsed.name}${extension}`))
        : [
            ...JS_IMPORT_SOURCE_EXTENSIONS.map(extension => `${moduleName}${extension}`),
            ...JS_IMPORT_SOURCE_EXTENSIONS.map(extension => path.join(moduleName, `index${extension}`)),
          ];

    return candidates.find(candidate => fs.existsSync(candidate)) ?? moduleName;
  }

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

  function getMatcherForFile(filePath: string): { matcher: PathsMatcher | null; patterns: string[] } | null {
    const configPath = tsConfigPath ?? findTsConfigForFile(filePath);
    if (!configPath) {
      return null;
    }

    if (!matcherCache.has(configPath)) {
      const config = parseTsconfig(configPath);
      const patterns = Object.keys(config.compilerOptions?.paths ?? {});
      let matcher: PathsMatcher | null;

      try {
        matcher = createPathsMatcher({ path: configPath, config });
      } catch {
        const configWithBaseUrl = {
          ...config,
          compilerOptions: { ...config.compilerOptions, baseUrl: path.dirname(configPath) },
        };
        matcher = createPathsMatcher({ path: configPath, config: configWithBaseUrl });
      }

      matcherCache.set(configPath, { matcher, patterns });
    }

    return matcherCache.get(configPath) ?? null;
  }

  function resolveAliases(request: string, importer: string): string[] {
    if (respectCoreModule && CORE_MODULES.has(request)) {
      return [];
    }

    const matchedConfig = getMatcherForFile(importer);
    if (
      !matchedConfig?.patterns.some(pattern => {
        const wildcardIndex = pattern.indexOf('*');
        return wildcardIndex === -1
          ? request === pattern
          : request.startsWith(pattern.slice(0, wildcardIndex)) && request.endsWith(pattern.slice(wildcardIndex + 1));
      })
    ) {
      return [];
    }

    return matchedConfig.matcher?.(request) ?? [];
  }

  return {
    name: PLUGIN_NAME,
    resolveId: {
      order: 'pre',
      async handler(request, importer, options) {
        if (!importer || request.startsWith('\0') || importer.charCodeAt(0) === 0) {
          return null;
        }

        // Convert relative paths to absolute to ensure proper tsconfig path resolution
        // This allows path aliases to work regardless of how the importer path is provided
        if (!path.isAbsolute(importer)) {
          importer = path.resolve(cwd ?? process.cwd(), importer);
        }

        const moduleNames = resolveAliases(request, importer);
        for (const moduleName of moduleNames) {
          const resolvedModuleName = resolveImportToSourceFile(moduleName);
          const resolved = await this.resolve(resolvedModuleName, importer, { skipSelf: true, ...options });

          if (resolved) {
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
        }

        const resolved = await this.resolve(request, importer, { skipSelf: true, ...options });
        if (!resolved) {
          return null;
        }

        // If localResolve is true, we need to check if the importer has been resolved by the tsconfig-paths plugin
        // if so, we need to resolve the request from the importer instead of the root and mark it as external
        if (localResolve) {
          const importerInfo = this.getModuleInfo(importer);
          const importerPluginMeta = importerInfo?.meta?.[PLUGIN_NAME];

          if (
            !path.isAbsolute(request) &&
            !request.startsWith('./') &&
            !request.startsWith('../') &&
            importerPluginMeta?.resolved
          ) {
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
          },
        };
      },
    },
  } satisfies Plugin;
}
