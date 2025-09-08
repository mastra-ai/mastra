import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import { watch } from 'rollup';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { aliasHono } from './plugins/hono-alias';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { bundleExternals } from './analyze';
import { noopLogger } from '@mastra/core/logger';
import { createWorkspacePackageMap } from '../bundler/workspaceDependencies';
import type { DependencyMetadata } from './types';
import { getPackageName, getPackageRootPath } from './utils';
import { findWorkspacesRoot } from 'find-workspaces';
import { relativeWorkspaceDeps } from './plugins/relative-workspace-deps';

export async function getInputOptions(
  entryFile: string,
  platform: 'node' | 'browser',
  env?: Record<string, string>,
  { sourcemap = false, transpilePackages = [] }: { sourcemap?: boolean; transpilePackages?: string[] } = {},
) {
  const dependencies = new Map<string, string>();
  const workspaceMap = await createWorkspacePackageMap();
  const workspaceRoot = findWorkspacesRoot()?.location;
  const depsToOptimize = new Map<string, DependencyMetadata>();

  if (transpilePackages.length) {
    for (const pkg of transpilePackages) {
      const isWorkspace = workspaceMap.has(pkg);
      const exports = ['*'];

      const pkgName = getPackageName(pkg);
      let rootPath: string | null = null;

      if (pkgName && pkgName !== '#tools') {
        rootPath = await getPackageRootPath(pkgName);
      }

      depsToOptimize.set(pkg, { exports, isWorkspace, rootPath });
    }

    const { output, reverseVirtualReferenceMap } = await bundleExternals(
      depsToOptimize,
      '.mastra/.build',
      noopLogger,
      {
        transpilePackages,
        isDev: true,
      },
      { workspaceRoot, workspaceMap },
    );

    for (const file of output) {
      if (file.type === 'asset') {
        continue;
      }

      if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
        dependencies.set(reverseVirtualReferenceMap.get(file.name)!, file.fileName);
      }
    }
  }

  const inputOptions = await getBundlerInputOptions(
    entryFile,
    {
      dependencies,
      externalDependencies: new Set(),
      invalidChunks: new Set(),
      workspaceMap,
    },
    platform,
    env,
    { sourcemap, isDev: true, workspaceRoot },
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
    inputOptions.plugins.push(relativeWorkspaceDeps(workspaceMap));
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
