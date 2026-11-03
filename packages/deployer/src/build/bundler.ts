import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import type { InputOptions, OutputOptions, Plugin, RolldownLog } from 'rolldown';
import { esmExternalRequirePlugin } from 'rolldown/plugins';
import type { WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import { aliasHono } from './plugins/hono-alias';
import { localStorageDetector } from './plugins/local-storage-detector';
import { moduleAlias } from './plugins/module-alias';
import { nodeModulesExternals, UNRESOLVED_WORKSPACE_IMPORT } from './plugins/node-modules-extension-resolver';
import { removeDeployer } from './plugins/remove-deployer';
import { subpathExternals } from './plugins/subpath-externals-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import {
  EXTERNAL_PROTOCOL_RE,
  TREESHAKE_SMALLEST,
  bundlerLogLevel,
  cjsGlobalsDefine,
  exactIdsRegex,
  getPlatformOptions,
  lodashImports,
  scopedDefine,
} from './rolldown';
import type { ExternalDependencyInfo } from './types';
import { getPackageName, slash } from './utils';
import type { BundlerPlatform } from './utils';

function realpathOrSelf(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function mastraInternalAliasPlugin(entryFile: string, { preserveSymlinks = false } = {}): Plugin {
  // Must match the id Rolldown gives the file when it's imported by path, or the entry would be bundled twice.
  const normalizedEntryFile = slash(preserveSymlinks ? entryFile : realpathOrSelf(entryFile));

  return {
    name: 'mastra-internal-alias',
    resolveId: {
      order: 'pre',
      filter: { id: /^(?:#server|#mastra|@mastra\/server\/)/ },
      handler(id) {
        if (id === '#server') {
          return slash(fileURLToPath(import.meta.resolve('@mastra/deployer/server')));
        }

        if (id.startsWith('@mastra/server/')) {
          return fileURLToPath(import.meta.resolve(id));
        }

        if (id === '#mastra') {
          return normalizedEntryFile;
        }
      },
    },
  } satisfies Plugin;
}

export function mastraToolsAliasPlugin(): Plugin {
  return {
    name: 'tools-rewriter',
    resolveId: {
      filter: { id: /^#tools$/ },
      handler() {
        return {
          id: './tools.mjs',
          external: true,
        };
      },
    },
  };
}

/** Makes Rolldown minify whole chunks (the replacement for `rollup-plugin-esbuild`'s `minify` at `renderChunk`). */
function minifyOutput(sourcemap: boolean): Plugin {
  return {
    name: 'mastra-minify',
    outputOptions(options) {
      return { ...options, minify: true, sourcemap: options.sourcemap ?? sourcemap };
    },
  };
}

export async function getInputOptions(
  entryFile: string,
  analyzedBundleInfo: {
    dependencies: Map<string, string>;
    externalDependencies: Map<string, ExternalDependencyInfo>;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectType?: string;
  },
  platform: BundlerPlatform,
  env: Record<string, string> = { 'process.env.NODE_ENV': JSON.stringify('production') },
  {
    sourcemap = false,
    minify = false,
    isDev = false,
    projectRoot,
    workspaceRoot = undefined,
    enableEsmShim = true,
    externalsPreset = false,
    explicitExternals = [],
    alias = {},
  }: {
    sourcemap?: boolean;
    minify?: boolean;
    isDev?: boolean;
    workspaceRoot?: string;
    projectRoot: string;
    enableEsmShim?: boolean;
    externalsPreset?: boolean;
    explicitExternals?: string[];
    alias?: Record<string, string>;
  },
): Promise<InputOptions> {
  const externals = externalsPreset ? explicitExternals : Array.from(analyzedBundleInfo.externalDependencies.keys());
  const aliasSources = new Set(Object.keys(alias));
  const subpath = subpathExternals(
    externals.filter(external => !aliasSources.has(external)),
    analyzedBundleInfo.workspaceMap,
  );
  // During `mastra dev` (and with `externals: true`) node_modules stay external.
  const keepNodeModulesExternal = isDev || externalsPreset;
  const optimizedDeps = exactIdsRegex(analyzedBundleInfo.dependencies.keys());

  const plugins: (Plugin | null)[] = [
    // Built-in: externals that are `require()`d become hoisted imports, like `@rollup/plugin-commonjs` did.
    subpath.patterns.length ? (esmExternalRequirePlugin({ external: subpath.patterns }) as unknown as Plugin) : null,
    moduleAlias(alias, entryFile, platform),
    subpath.plugin,
    optimizedDeps
      ? ({
          name: 'alias-optimized-deps',
          resolveId: {
            filter: { id: optimizedDeps },
            handler(id: string) {
              const filename = analyzedBundleInfo.dependencies.get(id)!;
              const absolutePath = join(workspaceRoot || projectRoot, filename);

              // During `mastra dev` we want to keep deps as external
              if (isDev) {
                return {
                  id: process.platform === 'win32' ? pathToFileURL(absolutePath).href : absolutePath,
                  external: true,
                };
              }

              return absolutePath;
            },
          },
        } satisfies Plugin)
      : null,
    mastraInternalAliasPlugin(entryFile),
    tsConfigPaths(isDev ? { localResolve: true } : { cwd: projectRoot }),
    mastraToolsAliasPlugin(),
    // hono is imported by the deployer's server, so it is bundled from here during `mastra dev`.
    isDev ? aliasHono() : null,
    scopedDefine(env),
    lodashImports(),
    keepNodeModulesExternal ? nodeModulesExternals({ platform, workspaceMap: analyzedBundleInfo.workspaceMap }) : null,
    localStorageDetector(realpathOrSelf(workspaceRoot || projectRoot)),
    removeDeployer(entryFile, { sourcemap }),
    minify ? minifyOutput(sourcemap) : null,
  ];

  return {
    logLevel: bundlerLogLevel(),
    treeshake: TREESHAKE_SMALLEST,
    cwd: projectRoot,
    ...getPlatformOptions(platform, {
      modules: workspaceRoot ? [join(workspaceRoot, 'node_modules')] : [],
    }),
    transform: {
      target: 'node20',
      define: cjsGlobalsDefine(enableEsmShim, platform),
    },
    external: [EXTERNAL_PROTOCOL_RE],
    plugins: plugins.filter(plugin => plugin !== null),
  } satisfies InputOptions;
}

export async function createBundler(
  inputOptions: InputOptions,
  outputOptions: Partial<OutputOptions> & { dir: string },
) {
  const bundler = await rolldown(inputOptions);

  return {
    write: () => {
      return bundler.write({
        ...outputOptions,
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      });
    },
    close: () => {
      return bundler.close();
    },
  };
}

/**
 * Checks whether a bundler log reports an unresolved import of a workspace package.
 * Returns the original import specifier if it's a workspace package that leaked
 * through, or undefined if it's not.
 */
export function getUnresolvedWorkspaceImport(
  log: Pick<RolldownLog, 'code' | 'exporter' | 'pluginCode'>,
  workspaceMap: Map<string, WorkspacePackageInfo>,
): string | undefined {
  // Rolldown reports the import specifier as `exporter` (`id` is the importer).
  if (log.code !== 'UNRESOLVED_IMPORT' && log.pluginCode !== UNRESOLVED_WORKSPACE_IMPORT) {
    return undefined;
  }

  const src = log.exporter ?? '';
  if (!src) {
    return undefined;
  }

  const pkgName = getPackageName(src);
  if (pkgName && workspaceMap.has(pkgName)) {
    return src;
  }

  return undefined;
}
