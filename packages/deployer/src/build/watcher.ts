import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import { watch } from 'rollup';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { aliasHono } from './plugins/hono-alias';
import { nodeModulesExtensionResolver } from './plugins/node-modules-extension-resolver';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { noopLogger } from '@mastra/core/logger';
import { getWorkspaceInformation } from '../bundler/workspaceDependencies';
import { analyzeBundle } from './analyze';
import path, { dirname } from 'path';
import { getPackageName } from './utils';
import { generateEntry } from './analyze/generateEntry';
import type { BundlerOptions } from './types';
import virtual from '@rollup/plugin-virtual';

export async function getInputOptions(
  entryFile: string,
  {
    env,
    bundlerOptions: { sourcemap },
    projectRoot,
    tools,
  }: {
    env: Record<string, string>;
    bundlerOptions: BundlerOptions;
    projectRoot: string;
    tools: Record<string, string>;
  },
) {
  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: entryFile });

  const analyzeEntryResult = await analyzeBundle(
    [entryFile],
    entryFile,
    {
      outputDir: path.join(projectRoot, '.mastra/.build'),
      projectRoot: workspaceRoot || projectRoot,
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

  // In `analyzeBundle` we output this file and we want to use that instead of the original entry file
  // const analyzedEntryFile = join(path.join(projectRoot, '.mastra/.build'), 'entry-0.mjs');

  const inputOptions = await getBundlerInputOptions(
    entryFile,
    {
      dependencies: deps,
      externalDependencies: new Set(),
      invalidChunks: new Set(),
      workspaceMap,
    },
    'node',
    env,
    { sourcemap, isDev: true, workspaceRoot, projectRoot },
  );

  if (Array.isArray(inputOptions.plugins)) {
    const toolImports: string[] = [];
    const toolsExports: string[] = [];

    let index = 0;
    for (const [key, value] of Object.entries(tools)) {
      const toolExport = `tool${index++}`;
      toolImports.push(`import * as ${toolExport} from '${path.join(projectRoot, '.mastra/.build', `${key}.mjs`)}';`);
      toolsExports.push(toolExport);
    }

    // filter out node-resolve plugin so all node_modules are external
    // and tsconfig-paths plugin as we are injection a custom one
    const plugins = [] as Plugin[];

    if (toolImports.length > 0) {
      plugins.push(
        virtual({
          './tools.mjs': `${toolImports.join('\n')}

export const tools = [${toolsExports.join(', ')}]`,
        }),
      );
    }

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
