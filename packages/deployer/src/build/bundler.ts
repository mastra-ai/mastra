import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { esmShim } from './plugins/esm-shim';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rollup, type InputOptions, type OutputOptions, type Plugin } from 'rollup';
import { esbuild } from './plugins/esbuild';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import { analyzeBundle } from './analyze';
import { removeAllOptionsFromMastraExceptPlugin } from './plugins/remove-all-except';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { join } from 'node:path';
import * as path from 'node:path';
import { slash, type BundlerPlatform, isDependencyPartOfPackage } from './utils';
import { subpathExternalsResolver } from './plugins/subpath-externals-resolver';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { removeDeployer } from './plugins/remove-deployer';
import { getPackageRootPath } from './package-info';
import * as resolve from 'resolve.exports';
import { readFile } from 'node:fs/promises';

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
  // For 'neutral' platform (Bun), use similar settings to 'node' for module resolution
  let nodeResolvePlugin =
    platform === 'node' || platform === 'neutral'
      ? nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node'],
        })
      : nodeResolve({
          preferBuiltins: false,
          browser: true,
        });

  const externalsCopy = new Set<string>(analyzedBundleInfo.externalDependencies.keys());
  const externals = externalsPreset ? [] : Array.from(externalsCopy);

  const normalizedEntryFile = slash(entryFile);
  return {
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    treeshake: 'smallest',
    preserveSymlinks: true,
    external: externals,
    plugins: [
      subpathExternalsResolver(externals),
      // Custom resolver to ensure @mastra/* packages are resolved from the BUNDLER'S context
      // (the workspace), not from the build directory's node_modules. This ensures we use
      // the correct workspace versions and avoid version mismatch issues.
      {
        name: 'mastra-package-resolver',
        async resolveId(id: string) {
          // Only handle @mastra/* imports that aren't already resolved
          if (!id.startsWith('@mastra/') || id.startsWith('/') || id.startsWith('.')) {
            return null;
          }

          // Check if this package should be external
          const isPartOfExternals = externals.some(external => isDependencyPartOfPackage(id, external));
          if (isPartOfExternals) {
            return null; // Let subpathExternalsResolver handle it
          }

          // Resolve from the bundler's context (workspace) using getPackageRootPath
          try {
            // Get the base package name (e.g., @mastra/core from @mastra/core/evals)
            const parts = id.split('/');
            const pkgName = parts[0]!.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]!;
            const subpath = parts.slice(pkgName.split('/').length).join('/');

            // First, check if this package is in the workspace map
            let pkgRoot: string | null = null;
            const workspaceInfo = analyzedBundleInfo.workspaceMap.get(pkgName);
            if (workspaceInfo) {
              pkgRoot = workspaceInfo.location;
            }

            // If not in workspace map, try to resolve from bundler's context
            if (!pkgRoot) {
              pkgRoot = await getPackageRootPath(pkgName, import.meta.dirname);
            }

            // If still not found, try resolving from workspace root or project root
            if (!pkgRoot && (workspaceRoot || projectRoot)) {
              pkgRoot = await getPackageRootPath(pkgName, workspaceRoot || projectRoot);
            }

            // If still not found and this is a @mastra/* package, try looking in workspace directories
            // The bundler runs from packages/deployer/dist, so go up 3 levels to reach monorepo root
            if (!pkgRoot && id.startsWith('@mastra/')) {
              const monorepoRoot = path.resolve(import.meta.dirname, '../../..');
              // First try standard node resolution from monorepo root
              pkgRoot = await getPackageRootPath(pkgName, monorepoRoot);

              // If not found, try common workspace directories directly
              if (!pkgRoot) {
                // Get the package short name (e.g., "memory" from "@mastra/memory")
                const shortName = pkgName.replace('@mastra/', '');

                // Try common workspace directory patterns
                const { existsSync } = await import('node:fs');
                const possibleLocations = [
                  path.join(monorepoRoot, 'packages', shortName),
                  path.join(monorepoRoot, 'observability', shortName),
                  path.join(monorepoRoot, 'stores', shortName),
                  path.join(monorepoRoot, 'deployers', shortName),
                  path.join(monorepoRoot, 'voice', shortName),
                  path.join(monorepoRoot, 'client-sdks', shortName),
                  path.join(monorepoRoot, 'sources', shortName),
                  path.join(monorepoRoot, 'routers', shortName),
                  path.join(monorepoRoot, 'runners', shortName),
                  // Also try subdirectory patterns (e.g., observability/mastra)
                  path.join(monorepoRoot, 'observability', 'mastra'), // @mastra/observability is at observability/mastra
                ];

                for (const loc of possibleLocations) {
                  const pkgJsonPath = path.join(loc, 'package.json');
                  if (existsSync(pkgJsonPath)) {
                    try {
                      const pkgJsonContent = await readFile(path.join(loc, 'package.json'), 'utf-8');
                      const pkg = JSON.parse(pkgJsonContent);
                      if (pkg.name === pkgName) {
                        pkgRoot = loc;
                        break;
                      }
                    } catch {
                      // Ignore read errors
                    }
                  }
                }
              }

            }

            if (process.env.MASTRA_BUNDLER_DEBUG === 'true' && pkgRoot) {
              console.log(`[mastra-package-resolver] Resolved ${id} to ${pkgRoot}`);
            }

            if (!pkgRoot) {
              return null; // Package not found, let other resolvers try
            }

            // Read package.json to resolve exports
            const pkgJsonBuffer = await readFile(path.join(pkgRoot, 'package.json'), 'utf-8');
            const pkgJson = JSON.parse(pkgJsonBuffer);

            // Resolve the subpath export
            const exportPath = subpath ? `./${subpath}` : '.';
            let resolvedPath: string | undefined;

            if (exportPath === '.') {
              resolvedPath = resolve.exports(pkgJson, '.')?.[0] || pkgJson.main || 'index.js';
            } else {
              resolvedPath = resolve.exports(pkgJson, exportPath)?.[0];
              if (!resolvedPath) {
                // Try direct path resolution as fallback
                resolvedPath = `dist/${subpath}/index.js`;
              }
            }

            if (resolvedPath) {
              const fullPath = path.join(pkgRoot, resolvedPath);
              if (process.env.MASTRA_BUNDLER_DEBUG === 'true') {
                console.log(`  resolved: ${fullPath}`);
              }
              return { id: fullPath, external: false };
            }
          } catch (err) {
            if (process.env.MASTRA_BUNDLER_DEBUG === 'true') {
              console.log(`[mastra-package-resolver] Error resolving ${id}:`, err);
            }
            // Resolution failed, let other resolvers try
          }

          return null;
        },
      } satisfies Plugin,
      {
        name: 'alias-optimized-deps',
        resolveId(id: string) {
          if (!analyzedBundleInfo.dependencies.has(id)) {
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
      alias({
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
      }),
      tsConfigPaths(),
      {
        name: 'tools-rewriter',
        resolveId(id: string) {
          if (id === '#tools') {
            return {
              id: './tools.mjs',
              external: true,
            };
          }
        },
      } satisfies Plugin,
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
