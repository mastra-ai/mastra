import { readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import * as pkg from 'empathic/package';
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

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectSourceFiles(fullPath));
      } else if (/\.[mc]?[jt]sx?$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist or isn't readable
  }
  return files;
}

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

    inputOptions.plugins.push({
      name: 'workspace-file-watcher',
      buildStart() {
        for (const [, info] of workspaceMap.entries()) {
          for (const file of collectSourceFiles(join(info.location, 'src'))) {
            this.addWatchFile(slash(file));
          }
          for (const file of collectSourceFiles(join(info.location, 'dist'))) {
            this.addWatchFile(slash(file));
          }
        }
      },
    } satisfies Plugin);
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
