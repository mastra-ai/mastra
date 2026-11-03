import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { createPathsMatcher, parseTsconfig } from 'get-tsconfig';
import type { PathsMatcher } from 'get-tsconfig';
import type { Plugin } from 'rolldown';

const PLUGIN_NAME = 'tsconfig-paths';
const JS_IMPORT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const CORE_MODULES = new Set([...builtinModules, ...builtinModules.map(moduleName => `node:${moduleName}`)]);
// `paths` keys can start with `#`, `@`, `~` or a letter, but never point at relative, absolute or virtual ids.
const ALIAS_CANDIDATE_FILTER = /^(?![./\0]|[A-Za-z]:[\\/])/;

export type PluginOptions = {
  tsConfigPath?: string;
  respectCoreModule?: boolean;
  localResolve?: boolean;
  cwd?: string;
};

type MatchedConfig = { matcher: PathsMatcher | null; patterns: string[] };

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

function matchesPattern(request: string, pattern: string) {
  const wildcardIndex = pattern.indexOf('*');
  return wildcardIndex === -1
    ? request === pattern
    : request.startsWith(pattern.slice(0, wildcardIndex)) && request.endsWith(pattern.slice(wildcardIndex + 1));
}

export function tsConfigPaths({
  tsConfigPath,
  respectCoreModule = true,
  localResolve,
  cwd,
}: PluginOptions = {}): Plugin {
  const matcherCache = new Map<string, MatchedConfig | null>();
  const configByDir = new Map<string, string | null>();
  // Modules reached through an alias. With `localResolve`, their bare imports are resolved from their own location.
  const aliasedModules = new Set<string>();

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

  // Nearest tsconfig.json (or NX-style tsconfig.base.json) with `paths`, walking up from `dir`. Every visited
  // directory is cached so sibling and nested importers don't touch the filesystem again.
  function findTsConfigForDir(dir: string): string | null {
    const visited: string[] = [];
    let currentDir = dir;
    let found: string | null = null;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const cached = configByDir.get(currentDir);
      if (cached !== undefined) {
        found = cached;
        break;
      }

      visited.push(currentDir);

      const candidate = ['tsconfig.json', 'tsconfig.base.json']
        .map(name => path.join(currentDir, name))
        .find(file => fs.existsSync(file) && hasPaths(file));
      if (candidate) {
        found = candidate;
        break;
      }

      currentDir = path.dirname(currentDir);
    }

    for (const visitedDir of visited) {
      configByDir.set(visitedDir, found);
    }

    return found;
  }

  function getMatcherForFile(filePath: string): MatchedConfig | null {
    const configPath = tsConfigPath ?? findTsConfigForDir(path.dirname(filePath));
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
    const matchedConfig = getMatcherForFile(importer);
    if (!matchedConfig?.patterns.some(pattern => matchesPattern(request, pattern))) {
      return [];
    }

    return matchedConfig.matcher?.(request) ?? [];
  }

  return {
    name: PLUGIN_NAME,
    resolveId: {
      order: 'pre',
      filter: { id: ALIAS_CANDIDATE_FILTER },
      async handler(request, importer, options) {
        if (!importer || importer.charCodeAt(0) === 0) {
          return null;
        }

        if (respectCoreModule && CORE_MODULES.has(request)) {
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
          const resolved = await this.resolve(resolvedModuleName, importer, { ...options, skipSelf: true });

          if (resolved) {
            aliasedModules.add(resolved.id);
            return resolved;
          }
        }

        // Ids that match no alias are left to the rest of the pipeline. Resolving them here would let Rolldown's
        // native resolver pick them from node_modules and bypass the externals logic of each pass.
        if (moduleNames.length || !localResolve || !aliasedModules.has(importer)) {
          return null;
        }

        // `mastra dev`: an aliased module can live outside the project (e.g. another monorepo package), so its
        // dependencies are resolved from where it lives and kept external. Hono is the exception and stays bundled.
        const resolved = await this.resolve(request, importer, { ...options, skipSelf: true });
        if (!resolved) {
          return null;
        }

        return {
          ...resolved,
          external: resolved.external || (!request.startsWith('hono/') && request !== 'hono'),
        };
      },
    },
  };
}
