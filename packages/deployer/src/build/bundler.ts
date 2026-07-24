import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import * as resolve from 'resolve.exports';
import { rollup } from 'rollup';
import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import type { WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import type { analyzeBundle } from './analyze';
import { esbuild } from './plugins/esbuild';
import { esmShim } from './plugins/esm-shim';
import { localStorageDetector } from './plugins/local-storage-detector';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { protocolExternalResolver } from './plugins/protocol-external-resolver';
import { removeDeployer } from './plugins/remove-deployer';
import { subpathExternalsResolver } from './plugins/subpath-externals-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { getNodeResolveOptions, getPackageName, slash } from './utils';
import type { BundlerPlatform } from './utils';

/**
 * Resolve a workspace package *subpath* specifier to the source file it points at, via the
 * package's `exports` map. Used to compile a workspace subpath that escaped analyze capture
 * inline, instead of letting it leak out of the bundle as an unresolved bare specifier.
 * Returns null for non-subpath / non-workspace ids, or when it cannot be resolved.
 * `resolve.exports` throws for a missing entry, so the lookup is guarded.
 */
export function resolveWorkspaceSubpathToSource(
  id: string,
  workspaceMap: Map<string, WorkspacePackageInfo>,
): string | null {
  const pkgName = getPackageName(id);
  // Only subpaths — package roots are handled by the analyze dependency map.
  if (!pkgName || id === pkgName) {
    return null;
  }
  const info = workspaceMap.get(pkgName);
  if (!info) {
    return null;
  }

  let pkgJson;
  try {
    pkgJson = JSON.parse(readFileSync(join(info.location, 'package.json'), 'utf-8'));
  } catch {
    return null;
  }

  let rel: string | undefined;
  try {
    rel = resolve.exports(pkgJson, `.${id.slice(pkgName.length)}`)?.[0];
  } catch {
    rel = undefined;
  }
  if (!rel) {
    return null;
  }

  return join(info.location, rel);
}

export function mastraInternalAliasPlugin(entryFile: string): Plugin {
  const normalizedEntryFile = slash(entryFile);

  return alias({
    entries: [
      {
        find: /^\#server$/,
        replacement: slash(fileURLToPath(import.meta.resolve('@mastra/deployer/server'))),
      },
      {
        find: /^\@mastra\/server\/(.*)/,
        replacement: `@mastra/server/$1`,
        customResolver: id => {
          if (id.startsWith('@mastra/server')) {
            return {
              id: fileURLToPath(import.meta.resolve(id)),
            };
          }
        },
      },
      { find: /^\#mastra$/, replacement: normalizedEntryFile },
    ],
  });
}

export function mastraToolsAliasPlugin(): Plugin {
  return {
    name: 'tools-rewriter',
    resolveId(id: string) {
      if (id === '#tools') {
        return {
          id: './tools.mjs',
          external: true,
        };
      }
    },
  };
}

export async function getInputOptions(
  entryFile: string,
  analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
  platform: BundlerPlatform,
  env: Record<string, string> = { 'process.env.NODE_ENV': JSON.stringify('production') },
  {
    sourcemap = false,
    isDev = false,
    projectRoot,
    workspaceRoot = undefined,
    enableEsmShim = true,
    externalsPreset = false,
  }: {
    sourcemap?: boolean;
    isDev?: boolean;
    workspaceRoot?: string;
    projectRoot: string;
    enableEsmShim?: boolean;
    externalsPreset?: boolean;
  },
): Promise<InputOptions> {
  const nodeResolvePlugin = nodeResolve(getNodeResolveOptions(platform));

  const externalsCopy = new Set<string>(analyzedBundleInfo.externalDependencies.keys());
  const externals = externalsPreset ? [] : Array.from(externalsCopy);

  return {
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    treeshake: 'smallest',
    preserveSymlinks: true,
    external: externals,
    plugins: [
      protocolExternalResolver(),
      subpathExternalsResolver(externals),
      {
        name: 'alias-optimized-deps',
        resolveId(id: string) {
          if (!analyzedBundleInfo.dependencies.has(id)) {
            // A workspace subpath imported transitively (by another workspace package) can escape
            // analyze capture and would otherwise leak out of the bundle as an unresolved bare
            // specifier - unregistered in the generated package.json, so ERR_MODULE_NOT_FOUND at
            // runtime. Resolve it to its source so the bundler compiles it inline instead.
            if (externalsPreset) {
              const workspaceSource = resolveWorkspaceSubpathToSource(id, analyzedBundleInfo.workspaceMap);
              if (workspaceSource) {
                return { id: workspaceSource, external: false };
              }
            }
            return null;
          }

          const filename = analyzedBundleInfo.dependencies.get(id)!;
          const absolutePath = join(workspaceRoot || projectRoot, filename);

          // During `mastra dev` we want to keep deps as external
          if (isDev) {
            return {
              id: process.platform === 'win32' ? pathToFileURL(absolutePath).href : absolutePath,
              external: true,
            };
          }

          // For production builds return the absolute path as-is so Rollup can handle itself
          return {
            id: absolutePath,
            external: false,
          };
        },
      } satisfies Plugin,
      mastraInternalAliasPlugin(entryFile),
      tsConfigPaths(),
      mastraToolsAliasPlugin(),
      esbuild({
        platform,
        define: env,
      }),
      optimizeLodashImports({
        include: '**/*.{js,ts,mjs,cjs}',
      }),
      externalsPreset
        ? null
        : commonjs({
            extensions: ['.js', '.ts'],
            transformMixedEsModules: true,
            esmExternals(id) {
              return externals.includes(id);
            },
          }),
      enableEsmShim ? esmShim() : undefined,
      externalsPreset ? nodeModulesExtensionResolver() : nodeResolvePlugin,
      // for debugging
      // {
      //   name: 'logger',
      //   //@ts-expect-error
      //   resolveId(id, ...args) {
      //     console.log({ id, args });
      //   },
      //   // @ts-expect-error
      // transform(code, id) {
      //   if (code.includes('class Duplexify ')) {
      //     console.log({ duplex: id });
      //   }
      // },
      // },
      json(),
      localStorageDetector(workspaceRoot || projectRoot),
      removeDeployer(entryFile, { sourcemap }),
      // treeshake unused imports
      esbuild({
        include: entryFile,
        platform,
      }),
    ].filter(Boolean),
  } satisfies InputOptions;
}

export async function createBundler(
  inputOptions: InputOptions,
  outputOptions: Partial<OutputOptions> & { dir: string },
) {
  const bundler = await rollup(inputOptions);

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
