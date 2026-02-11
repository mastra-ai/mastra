import { dirname } from 'node:path';
import * as pkg from 'empathic/package';
import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import { watch } from 'rollup';
import { getWorkspaceInformation } from '../bundler/workspaceDependencies';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { aliasHono } from './plugins/hono-alias';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import type { BundlerOptions } from './types';
import { slash } from './utils';
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

  const inputOptions = await getBundlerInputOptions(
    entryFile,
    {
      dependencies: new Map(),
      externalDependencies: new Map(),
      workspaceMap,
    },
    platform,
    env,
    { sourcemap, isDev: true, workspaceRoot, projectRoot, externalsPreset: bundlerOptions?.externals === true },
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
