import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import * as pkg from 'empathic/package';
import { resolveModule } from 'local-pkg';
import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import { watch } from 'rollup';
import { getWorkspaceInformation } from '../bundler/workspaceDependencies';
import { analyzeBundle } from './analyze';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { aliasHono } from './plugins/hono-alias';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import type { BundlerOptions } from './types';
import { getPackageName, slash } from './utils';
import type { BundlerPlatform } from './utils';

export async function getInputOptions(
  entryFile: string,
  platform: BundlerPlatform,
  env?: Record<string, string>,
  {
    sourcemap = false,
    bundlerOptions = {
      enableSourcemap: false,
      enableEsmShim: true,
      externals: true,
    },
  }: { sourcemap?: boolean; bundlerOptions?: BundlerOptions } = {},
) {
  const closestPkgJson = pkg.up({ cwd: dirname(entryFile) });
  const projectRoot = closestPkgJson ? dirname(slash(closestPkgJson)) : slash(process.cwd());
  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: entryFile });

  const analyzeEntryResult = await analyzeBundle(
    [entryFile],
    entryFile,
    {
      outputDir: posix.join(process.cwd(), '.mastra', '.build'),
      projectRoot: workspaceRoot || process.cwd(),
      platform,
      isDev: true,
      bundlerOptions,
    },
    noopLogger,
  );

  const deps = /* @__PURE__ */ new Map();
  for (const [dep, metadata] of analyzeEntryResult.dependencies.entries()) {
    const pkgName = getPackageName(dep);
    if (pkgName && workspaceMap.has(pkgName)) {
      deps.set(dep, metadata);
    }
  }

  const inputOptions = await getBundlerInputOptions(
    entryFile,
    {
      dependencies: deps,
      externalDependencies: new Map(),
      workspaceMap,
    },
    platform,
    env,
    { sourcemap, isDev: true, workspaceRoot, projectRoot, externalsPreset: bundlerOptions?.externals === true },
  );

  // Pre-compute source entry points for workspace packages so the watcher
  // tracks actual source files rather than compiled dist/ output.
  const workspaceSourceEntries = new Map<string, string>();
  for (const [pkgName, info] of workspaceMap.entries()) {
    try {
      const pkgJson = JSON.parse(readFileSync(join(info.location, 'package.json'), 'utf-8'));
      if (pkgJson.source) {
        workspaceSourceEntries.set(pkgName, slash(join(info.location, pkgJson.source)));
      }
    } catch {
      // package.json unreadable — fall back to resolveModule
    }
  }

  if (Array.isArray(inputOptions.plugins)) {
    // filter out node-resolve plugin so all node_modules are external
    // and tsconfig-paths plugin as we are injection a custom one
    const plugins = [] as Plugin[];
    inputOptions.plugins.forEach(plugin => {
      if ((plugin as Plugin | undefined)?.name === 'node-resolve') {
        return;
      }

      if ((plugin as Plugin | undefined)?.name === 'tsconfig-paths') {
        plugins.push(
          tsConfigPaths({
            localResolve: true,
          }),
        );
        return;
      }

      // Replace alias-optimized-deps with workspace-source-resolver so that
      // workspace package source files are included in Rollup's module graph
      // and automatically watched for changes during `mastra dev`.
      if ((plugin as Plugin | undefined)?.name === 'alias-optimized-deps') {
        plugins.push({
          name: 'workspace-source-resolver',
          resolveId(id: string) {
            const pkgName = getPackageName(id);
            if (!pkgName || !workspaceMap.has(pkgName)) {
              return null;
            }
            // Prefer "source" field so we watch source files, not compiled dist/
            if (id === pkgName) {
              const sourceEntry = workspaceSourceEntries.get(pkgName);
              if (sourceEntry) {
                return { id: sourceEntry, external: false };
              }
            }
            // Fall back to resolveModule (uses main/exports)
            const resolved = resolveModule(id);
            if (resolved) {
              return { id: slash(resolved), external: false };
            }
            return null;
          },
        } satisfies Plugin);
        return;
      }

      plugins.push(plugin as Plugin);
    });

    inputOptions.plugins = plugins;
    inputOptions.plugins.push(aliasHono());
    // fixes imports like lodash/fp/get
    inputOptions.plugins.push(nodeModulesExtensionResolver());
  }

  return inputOptions;
}

export async function createWatcher(inputOptions: InputOptions, outputOptions: OutputOptions) {
  const watcher = await watch({
    ...inputOptions,
    output: {
      ...outputOptions,
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: '[name].mjs',
    },
  });

  return watcher;
}
