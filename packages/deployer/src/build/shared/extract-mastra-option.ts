import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IMastraLogger } from '@internal/core/logger';
import type { Config as MastraConfig } from '@mastra/core/mastra';
import * as pkg from 'empathic/package';
import { rolldown } from 'rolldown';
import type { Plugin, RolldownOutput } from 'rolldown';
import { removeAllOptionsFromMastraExceptPlugin } from '../plugins/remove-all-except';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { BARE_SPECIFIER_FILTER, TREESHAKE_SMALLEST, lodashImports } from '../rolldown';
import { isBareModuleSpecifier } from '../utils';

const TS_SOURCE = /\.tsx?$/;
const NODE_MODULES = `${sep}node_modules${sep}`;

/**
 * Packages outside node_modules, such as workspace packages, may ship raw TypeScript (e.g. `exports` pointing to
 * `src/index.ts`), which Node cannot load from the extracted config. Inline those so they get transpiled. Bare
 * imports made from inlined sources stay external but are pinned to the file they resolve to from that source: the
 * extracted config lives in `.mastra/output` and can't see the package's own `node_modules` (e.g. pnpm isolated
 * installs). Every other bare import stays external by name, as Rolldown would otherwise bundle `node_modules`.
 */
function typescriptSourcesResolver(entryFile: string): Plugin {
  const appPackageJson = pkg.up({ cwd: dirname(entryFile) });
  const appDir = appPackageJson ? dirname(appPackageJson) : dirname(entryFile);
  // The entry keeps the path it was given, resolved files are real paths
  const appRoots = [appDir + sep, realpathSync(appDir) + sep];
  const isInlinedSource = (file: string) =>
    isAbsolute(file) && !file.includes(NODE_MODULES) && !appRoots.some(root => file.startsWith(root));

  return {
    name: 'typescript-sources-resolver',
    resolveId: {
      // `post` still runs before Rolldown's native resolver, after aliases and tsconfig paths had their turn
      order: 'post',
      filter: { id: BARE_SPECIFIER_FILTER },
      async handler(id, importer, options) {
        if (!importer || !isBareModuleSpecifier(id)) {
          return null;
        }

        const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
        if (resolved?.external) {
          return resolved;
        }

        if (resolved && TS_SOURCE.test(resolved.id) && !resolved.id.includes(NODE_MODULES)) {
          return resolved.id;
        }

        if (resolved && isInlinedSource(importer)) {
          return { id: pathToFileURL(resolved.id).href, external: true };
        }

        return { id, external: true };
      },
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
  return rolldown({
    logLevel: 'silent',
    input: {
      [`${name}-config`]: entryFile,
    },
    platform: 'node',
    resolve: {
      // Same lookup as @rollup/plugin-node-resolve did, plus raw TS for workspace packages
      mainFields: ['module', 'main'],
      extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.jsx'],
    },
    treeshake: TREESHAKE_SMALLEST,
    experimental: { attachDebugInfo: 'none' },
    plugins: [
      tsConfigPaths(),
      typescriptSourcesResolver(entryFile),
      // Inlined sources import lodash by file URL, where Node can't pick named exports out of CommonJS.
      lodashImports(),
      removeAllOptionsFromMastraExceptPlugin(entryFile, name, result, { logger }),
    ],
  });
}

export async function extractMastraOption<T extends keyof MastraConfig>(
  name: T,
  entryFile: string,
  outputDir: string,
  logger?: IMastraLogger,
): Promise<{
  bundleOutput: RolldownOutput;
  getConfig: () => Promise<MastraConfig[T]>;
} | null> {
  const result = {
    hasCustomConfig: false,
  };

  const bundler = await extractMastraOptionBundler(name, entryFile, result, logger);

  let output: RolldownOutput;
  try {
    output = await bundler.write({
      dir: outputDir,
      format: 'es',
      entryFileNames: '[name].mjs',
    });
  } finally {
    await bundler.close();
  }

  if (result.hasCustomConfig) {
    const configPath = `${outputDir}/${name}-config.mjs`;

    return {
      bundleOutput: output,
      getConfig: () => import(pathToFileURL(configPath).href).then(m => m[name] as MastraConfig[T]),
    };
  }

  return null;
}
