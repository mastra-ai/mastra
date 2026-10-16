import { realpathSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import * as pkg from 'empathic/package';
import { rollup } from 'rollup';
import type { Plugin, RollupOutput } from 'rollup';
import { getWorkspaceInformation } from '../../bundler/workspaceDependencies';
import { esbuild } from '../plugins/esbuild';
import { removeAllOptionsFromMastraExceptPlugin } from '../plugins/remove-all-except';
import { recursiveRemoveNonReferencedNodes } from '../plugins/remove-unused-references';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { getNodeResolveOptions, getPackageName, isBareModuleSpecifier } from '../utils';

const TS_SOURCE = /\.tsx?$/;

/**
 * Workspace packages may ship raw TypeScript (e.g. `exports` pointing to `src/index.ts`), which Node cannot load
 * from the extracted config. Inline those so esbuild transpiles them. Bare imports made from inside a workspace
 * package stay external but are pinned to the file they resolve to from that package: the extracted config lives in
 * `.mastra/output` and can't see the package's own `node_modules` (e.g. pnpm isolated installs).
 */
async function workspacePackagesResolver(entryFile: string): Promise<Plugin | null> {
  const { workspaceMap, workspaceRoot } = await getWorkspaceInformation({
    dir: dirname(entryFile),
    mastraEntryFile: entryFile,
  });
  if (workspaceMap.size === 0) {
    return null;
  }

  const closestPkgJson = pkg.up({ cwd: dirname(entryFile) });
  const appRoot = realpathSync(closestPkgJson ? dirname(closestPkgJson) : process.cwd()) + sep;
  // Resolved ids are real paths, so compare against real workspace locations; the app's own files keep today's behaviour
  const workspaceLocations = [...workspaceMap.values()]
    .map(({ location }) => realpathSync(location) + sep)
    .filter(location => location !== appRoot);
  const isInsideWorkspacePackage = (file: string) =>
    !file.includes(`${sep}node_modules${sep}`) && workspaceLocations.some(location => file.startsWith(location));

  const resolver = nodeResolve({
    ...getNodeResolveOptions('node'),
    extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
    modulePaths: workspaceRoot ? [join(workspaceRoot, 'node_modules')] : [],
  });
  const resolveHook = resolver.resolveId!;
  const resolve = typeof resolveHook === 'function' ? resolveHook : resolveHook.handler;

  return {
    ...resolver,
    name: 'workspace-packages-resolver',
    async resolveId(id, importer, options) {
      if (!importer || !isBareModuleSpecifier(id)) {
        return null;
      }

      const isWorkspacePackage = workspaceMap.has(getPackageName(id) ?? '');
      const fromWorkspacePackage = isInsideWorkspacePackage(importer);
      if (!isWorkspacePackage && !fromWorkspacePackage) {
        return null;
      }

      const resolved = await resolve.call(this, id, importer, options);
      if (!resolved || typeof resolved !== 'object' || resolved.external) {
        return null;
      }

      if (isWorkspacePackage && TS_SOURCE.test(resolved.id)) {
        return resolved.id;
      }

      if (fromWorkspacePackage) {
        return { id: pathToFileURL(resolved.id).href, external: true };
      }

      // Built workspace packages imported by the app itself stay external like any other dependency
      return null;
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
