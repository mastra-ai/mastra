import type { InputOptions, OutputOptions } from 'rollup';
import { watch } from 'rollup';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { aliasHono } from './plugins/hono-alias';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { bundleExternals } from './analyze';
import { noopLogger } from '@mastra/core/logger';

export async function getInputOptions(
  entryFile: string,
  platform: 'node' | 'browser',
  env?: Record<string, string>,
  { sourcemap = false, transpilePackages = [] }: { sourcemap?: boolean; transpilePackages?: string[] } = {},
) {
  const dependencies = new Map<string, string>();

  if (transpilePackages.length) {
    const { output, reverseVirtualReferenceMap } = await bundleExternals(
      new Map(transpilePackages.map(pkg => [pkg, ['*']])),
      '.mastra/.build',
      noopLogger,
      {
        transpilePackages,
      },
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
    },
    platform,
    env,
    { sourcemap },
  );

  if (Array.isArray(inputOptions.plugins)) {
    // filter out node-resolve plugin so all node_modules are external
    // and tsconfig-paths plugin as we are injection a custom one
    inputOptions.plugins = inputOptions.plugins.filter(
      // @ts-ignore
      plugin => !plugin || !plugin?.name || (plugin.name !== 'node-resolve' && plugin.name !== 'tsconfig-paths'),
    );

    inputOptions.plugins.unshift(
      tsConfigPaths({
        localResolve: true,
      }),
    );
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
