import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IMastraLogger } from '@internal/core/logger';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import * as pkg from 'empathic/package';
import { rollup } from 'rollup';
import type { Plugin, RollupOutput } from 'rollup';
import { esbuild } from '../plugins/esbuild';
import { removeAllOptionsFromMastraExceptPlugin } from '../plugins/remove-all-except';
import { recursiveRemoveNonReferencedNodes } from '../plugins/remove-unused-references';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { getNodeResolveOptions, isBareModuleSpecifier } from '../utils';

const TS_SOURCE = /\.tsx?$/;
const NODE_MODULES = `${sep}node_modules${sep}`;

/**
 * Packages outside node_modules, such as workspace packages, may ship raw TypeScript (e.g. `exports` pointing to
 * `src/index.ts`), which Node cannot load from the extracted config. Inline those so esbuild transpiles them. Bare
 * imports made from inlined sources stay external but are pinned to the file they resolve to from that source: the
 * extracted config lives in `.mastra/output` and can't see the package's own `node_modules` (e.g. pnpm isolated
 * installs). The app's own imports keep resolving by name.
 */
function typescriptSourcesResolver(entryFile: string): Plugin {
  const appPackageJson = pkg.up({ cwd: dirname(entryFile) });
  const appDir = appPackageJson ? dirname(appPackageJson) : dirname(entryFile);
  // App files keep the entry's path, files resolved by node-resolve are real paths
  const appRoots = [appDir + sep, realpathSync(appDir) + sep];
  const isInlinedSource = (file: string) =>
    isAbsolute(file) && !file.includes(NODE_MODULES) && !appRoots.some(root => file.startsWith(root));

  const resolver = nodeResolve({
    ...getNodeResolveOptions('node'),
    extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
  });
  const resolveHook = resolver.resolveId!;
  const resolve = typeof resolveHook === 'function' ? resolveHook : resolveHook.handler;

  return {
    ...resolver,
    name: 'typescript-sources-resolver',
    async resolveId(id, importer, options) {
      if (!importer || !isBareModuleSpecifier(id)) {
        return null;
      }

      // node-resolve passes each result back through `this.resolve`, and the commonjs plugin's resolveId loads every
      // `.js` result to check whether it is CommonJS. With the live context that loads and transforms every installed
      // package reachable from a surviving import, recursively, though all of them end up external.
      const context = Object.create(this, { resolve: { value: async () => null } });
      const resolved = await resolve.call(context, id, importer, options);
      if (!resolved || typeof resolved !== 'object' || resolved.external) {
        return null;
      }

      if (TS_SOURCE.test(resolved.id) && !resolved.id.includes(NODE_MODULES)) {
        return resolved.id;
      }

      return isInlinedSource(importer) ? { id: pathToFileURL(resolved.id).href, external: true } : null;
    },
  };
}

export function extractMastraOptionBundler(
  name: keyof MastraConfig,
  entryFile: string,
  result: {
    hasCustomConfig: boolean;
  },
  logger?: IMastraLogger,
) {
  return rollup({
    logLevel: 'silent',
    input: {
      [`${name}-config`]: entryFile,
    },
    treeshake: 'smallest',
    plugins: [
      tsConfigPaths(),
      typescriptSourcesResolver(entryFile),
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
    // Chunks are written outside any package with "type": "module", so a `.js` chunk would be loaded as CommonJS
    // (#28491). The hash keeps them distinct from the main bundle's chunks in `.mastra/output`.
    chunkFileNames: '[name]-[hash].mjs',
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
