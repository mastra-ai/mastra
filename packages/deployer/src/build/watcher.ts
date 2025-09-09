import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import { watch } from 'rollup';
import { findWorkspacesRoot } from 'find-workspaces';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { aliasHono } from './plugins/hono-alias';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { noopLogger } from '@mastra/core/logger';
import { createWorkspacePackageMap } from '../bundler/workspaceDependencies';
import { analyzeBundle } from './analyze';
import path, { dirname } from 'path';
import { getPackageName } from './utils';
import { packageUp } from 'package-up';

export async function getInputOptions(
  entryFile: string,
  platform: 'node' | 'browser',
  env?: Record<string, string>,
  { sourcemap = false }: { sourcemap?: boolean } = {},
) {
  const closestPkgJson = await packageUp({ cwd: dirname(entryFile) });
  const projectRoot = closestPkgJson ?? process.cwd();
  const workspaceMap = await createWorkspacePackageMap();
  const workspaceRoot = findWorkspacesRoot()?.location;

  const analyzeEntryResult = await analyzeBundle(
    [entryFile],
    entryFile,
    {
      outputDir: path.join(process.cwd(), '.mastra/.build'),
      projectRoot: workspaceRoot || process.cwd(),
      platform: 'node',
      isDev: true,
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
      externalDependencies: new Set(),
      invalidChunks: new Set(),
      workspaceMap,
    },
    platform,
    env,
    { sourcemap, isDev: true, workspaceRoot, projectRoot },
  );

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
