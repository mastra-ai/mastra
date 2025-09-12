import type { IMastraLogger } from '@mastra/core/logger';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import virtual from '@rollup/plugin-virtual';
import { fileURLToPath } from 'node:url';
import { rollup, type OutputChunk, type Plugin, type SourceMap } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import { isNodeBuiltin } from '../isNodeBuiltin';
import { removeDeployer } from '../plugins/remove-deployer';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { getPackageName, getPackageRootPath } from '../utils';
import { type WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import type { DependencyMetadata } from '../types';
import { DEPS_TO_IGNORE } from './constants';

/**
 * Configures and returns the Rollup plugins needed for analyzing entry files.
 * Sets up module resolution, transpilation, and custom alias handling for Mastra-specific imports.
 */
function getInputPlugins(
  { entry, isVirtualFile }: { entry: string; isVirtualFile: boolean },
  mastraEntry: string,
  { sourcemapEnabled }: { sourcemapEnabled: boolean },
): Plugin[] {
  const normalizedMastraEntry = mastraEntry.replaceAll('\\', '/');
  let virtualPlugin = null;
  if (isVirtualFile) {
    virtualPlugin = virtual({
      '#entry': entry,
    });
    entry = '#entry';
  }

  const plugins = [];
  if (virtualPlugin) {
    plugins.push(virtualPlugin);
  }

  plugins.push(
    ...[
      tsConfigPaths(),
      {
        name: 'custom-alias-resolver',
        resolveId(id: string) {
          if (id === '#server') {
            return fileURLToPath(import.meta.resolve('@mastra/deployer/server')).replaceAll('\\', '/');
          }
          if (id === '#mastra') {
            return normalizedMastraEntry;
          }
          if (id.startsWith('@mastra/server')) {
            return fileURLToPath(import.meta.resolve(id));
          }
        },
      } satisfies Plugin,
      json(),
      esbuild(),
      commonjs({
        strictRequires: 'debug',
        ignoreTryCatch: false,
        transformMixedEsModules: true,
        extensions: ['.js', '.ts'],
      }),
      removeDeployer(mastraEntry, { sourcemap: sourcemapEnabled }),
      esbuild(),
    ],
  );

  return plugins;
}

/**
 * Extracts and categorizes dependencies from Rollup output to determine which ones need optimization.
 * Analyzes both static imports and dynamic imports while filtering out Node.js built-ins and ignored dependencies.
 * Identifies workspace packages and resolves package root paths for proper bundling optimization.
 */
async function captureDependenciesToOptimize(
  output: OutputChunk,
  workspaceMap: Map<string, WorkspacePackageInfo>,
): Promise<Map<string, DependencyMetadata>> {
  const depsToOptimize = new Map<string, DependencyMetadata>();

  for (const [dependency, bindings] of Object.entries(output.importedBindings)) {
    if (isNodeBuiltin(dependency) || DEPS_TO_IGNORE.includes(dependency)) {
      continue;
    }

    // The `getPackageName` helper also handles subpaths so we only get the proper package name
    const pkgName = getPackageName(dependency);
    let rootPath: string | null = null;
    let isWorkspace = false;

    if (pkgName) {
      rootPath = await getPackageRootPath(pkgName);
      isWorkspace = workspaceMap.has(pkgName);
    }

    depsToOptimize.set(dependency, { exports: bindings, rootPath, isWorkspace });
  }

  // #tools is a generated dependency, we don't want our analyzer to handle it
  const dynamicImports = output.dynamicImports.filter(d => !DEPS_TO_IGNORE.includes(d));
  if (dynamicImports.length) {
    for (const dynamicImport of dynamicImports) {
      if (!depsToOptimize.has(dynamicImport) && !isNodeBuiltin(dynamicImport)) {
        depsToOptimize.set(dynamicImport, { exports: ['*'], rootPath: null, isWorkspace: false });
      }
    }
  }

  return depsToOptimize;
}

/**
 * Analyzes the entry file to identify external dependencies and their imports. This allows us to treeshake all code that is not used.
 *
 * @param entryConfig - Configuration object for the entry file
 * @param entryConfig.entry - The entry file path or content
 * @param entryConfig.isVirtualFile - Whether the entry is a virtual file (content string) or a file path
 * @param mastraEntry - The mastra entry point
 * @param options - Configuration options for the analysis
 * @param options.logger - Logger instance for debugging
 * @param options.sourcemapEnabled - Whether sourcemaps are enabled
 * @param options.workspaceMap - Map of workspace packages
 * @returns A promise that resolves to an object containing the analyzed dependencies and generated output
 */
export async function analyzeEntry(
  {
    entry,
    isVirtualFile,
  }: {
    entry: string;
    isVirtualFile: boolean;
  },
  mastraEntry: string,
  {
    sourcemapEnabled,
    workspaceMap,
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
  },
): Promise<{
  dependencies: Map<string, DependencyMetadata>;
  output: {
    code: string;
    map: SourceMap | null;
  };
}> {
  const optimizerBundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: isVirtualFile ? '#entry' : entry,
    treeshake: 'smallest',
    preserveSymlinks: true,
    plugins: getInputPlugins({ entry, isVirtualFile }, mastraEntry, { sourcemapEnabled }),
    external: DEPS_TO_IGNORE,
  });

  const { output } = await optimizerBundler.generate({
    format: 'esm',
    inlineDynamicImports: true,
  });

  await optimizerBundler.close();

  const depsToOptimize = await captureDependenciesToOptimize(output[0] as OutputChunk, workspaceMap);

  return {
    dependencies: depsToOptimize,
    output: {
      code: output[0].code,
      map: output[0].map as SourceMap,
    },
  };
}
