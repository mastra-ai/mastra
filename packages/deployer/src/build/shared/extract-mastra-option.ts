import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { rollup } from 'rollup';
import type { Plugin, RollupOutput } from 'rollup';
import { getWorkspaceInformation } from '../../bundler/workspaceDependencies';
import { esbuild } from '../plugins/esbuild';
import { removeAllOptionsFromMastraExceptPlugin } from '../plugins/remove-all-except';
import { recursiveRemoveNonReferencedNodes } from '../plugins/remove-unused-references';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { getPackageName } from '../utils';

/**
 * Workspace packages may ship raw TypeScript (e.g. `exports` pointing to `src/index.ts`).
 * Leaving them external makes the extracted config unloadable by Node, so inline the ones that resolve to TypeScript sources.
 */
async function workspacePackagesResolver(entryFile: string): Promise<Plugin | null> {
  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({
    dir: dirname(entryFile),
    mastraEntryFile: entryFile,
  });
  if (workspaceMap.size === 0) {
    return null;
  }

  const resolver = nodeResolve({
    preferBuiltins: true,
    exportConditions: ['node'],
    extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
    modulePaths: workspaceRoot ? [`${workspaceRoot}/node_modules`] : [],
  });

  return {
    ...resolver,
    name: 'workspace-packages-resolver',
    async resolveId(id, importer, options) {
      const pkgName = getPackageName(id);
      if (!pkgName || !workspaceMap.has(pkgName)) {
        return null;
      }
      const hook = resolver.resolveId;
      const handler = typeof hook === 'function' ? hook : hook?.handler;
      const resolved = await handler?.call(this, id, importer, options);
      const resolvedId = typeof resolved === 'string' ? resolved : resolved ? resolved.id : undefined;
      // Built workspace packages (plain JS) stay external like any other dependency
      if (!resolvedId || !/\.tsx?$/.test(resolvedId)) {
        return null;
      }
      return resolved;
    },
  };
}

export async function extractMastraOptionBundler(
  name: keyof MastraConfig,
  entryFile: string,
  result: {
    hasCustomConfig: boolean;
  },
  logger?: IMastraLogger,
) {
  const workspaceResolver = await workspacePackagesResolver(entryFile);

  return rollup({
    logLevel: 'silent',
    input: {
      [`${name}-config`]: entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      tsConfigPaths(),
      ...(workspaceResolver ? [workspaceResolver] : []),
      // transpile typescript to something we understand
      esbuild(),
      optimizeLodashImports({
        include: '**/*.{js,ts,mjs,cjs}',
      }),
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      json(),
      removeAllOptionsFromMastraExceptPlugin(entryFile, name, result, { logger }),
      // let esbuild remove all unused imports
      esbuild(),
      {
        name: 'cleanup',
        transform(code, id) {
          if (id !== entryFile) {
            return;
          }

          return recursiveRemoveNonReferencedNodes(code);
        },
      },
      // let esbuild remove it once more
      esbuild(),
    ],
  });
}

export async function extractMastraOption<T extends keyof MastraConfig>(
  name: T,
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<{
  bundleOutput: RollupOutput;
  getConfig: () => Promise<MastraConfig[T]>;
} | null> {
  const result = {
    hasCustomConfig: false,
  };

  const bundler = await extractMastraOptionBundler(name, entryFile, result, logger);

  const output = await bundler.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
  });

  if (result.hasCustomConfig) {
    const configPath = `${outputDir}/${name}-config.mjs`;

    return {
      bundleOutput: output,
      getConfig: () => import(pathToFileURL(configPath).href).then(m => m[name] as MastraConfig[T]),
    };
  }

  return null;
}
