import { dirname, posix } from 'node:path';
import { noopLogger } from '@internal/core/logger';
import * as pkg from 'empathic/package';
import { watch } from 'rolldown';
import type { InputOptions, OutputOptions, RolldownWatcher } from 'rolldown';
import { getWorkspaceInformation } from '../bundler/workspaceDependencies';
import { analyzeBundle } from './analyze';
import { getInputOptions as getBundlerInputOptions } from './bundler';
import { workspaceDepsWatcher } from './plugins/workspace-deps-watcher';
import { chunkFileNames } from './rolldown';
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
      // `mastra dev` never minifies — readable output matters more than size here.
      enableMinify: false,
      enableEsmShim: true,
      externals: true,
    },
    analysisEntries = [entryFile],
    outputDir: outputDirOption,
  }: { sourcemap?: boolean; bundlerOptions?: BundlerOptions; analysisEntries?: string[]; outputDir?: string } = {},
) {
  const closestPkgJson = pkg.up({ cwd: dirname(entryFile) });
  const projectRoot = closestPkgJson ? dirname(slash(closestPkgJson)) : slash(process.cwd());
  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile: entryFile });

  const outputDir = outputDirOption ? slash(outputDirOption) : posix.join(process.cwd(), '.mastra', '.build');

  const analyzeEntryResult = await analyzeBundle(
    analysisEntries,
    entryFile,
    {
      outputDir,
      projectRoot: workspaceRoot || process.cwd(),
      platform,
      isDev: true,
      bundlerOptions,
      env,
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

  // `isDev` already keeps node_modules external, bundles hono from the deployer and uses local tsconfig resolution.
  if (Array.isArray(inputOptions.plugins)) {
    const depsToOptimize = analyzeEntryResult.depsToOptimize;
    const resolvedWorkspaceRoot = analyzeEntryResult.workspaceRoot || workspaceRoot;
    if (depsToOptimize?.size && resolvedWorkspaceRoot) {
      inputOptions.plugins.push(
        workspaceDepsWatcher({
          depsToOptimize,
          optimizedDependencyFiles: deps,
          workspaceMap,
          workspaceRoot: resolvedWorkspaceRoot,
          outputDir: analyzeEntryResult.outputDir || outputDir,
          platform,
          bundlerOptions,
        }),
      );
    }
  }

  return inputOptions;
}

export async function createWatcher(
  inputOptions: InputOptions,
  outputOptions: OutputOptions,
): Promise<RolldownWatcher> {
  const watcher = watch({
    ...inputOptions,
    output: {
      ...outputOptions,
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames,
    },
  });

  // Rolldown keeps each build alive until its result is closed (`closeBundle` runs then). Registered first so it runs
  // before listeners added by callers.
  watcher.on('event', async event => {
    if (event.code === 'BUNDLE_END' || event.code === 'ERROR') {
      await event.result?.close();
    }
  });

  return watcher;
}
