import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import esmShim from '@rollup/plugin-esm-shim';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rollup, type InputOptions, type OutputOptions, type Plugin } from 'rollup';
import { esbuild } from './plugins/esbuild';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import { analyzeBundle } from './analyze';
import { removeDeployer } from './plugins/remove-deployer';
import { tsConfigPaths } from './plugins/tsconfig-paths';
import { join } from 'node:path';
import { slash } from './utils';

export async function getInputOptions(
  entryFile: string,
  analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
  platform: 'node' | 'browser',
  env: Record<string, string> = { 'process.env.NODE_ENV': JSON.stringify('production') },
  {
    sourcemap = false,
    isDev = false,
    projectRoot,
    workspaceRoot = undefined,
    enableEsmShim = true,
  }: {
    sourcemap?: boolean;
    isDev?: boolean;
    workspaceRoot?: string;
    projectRoot: string;
    enableEsmShim?: boolean;
  },
): Promise<InputOptions> {
  let nodeResolvePlugin =
    platform === 'node'
      ? nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node'],
        })
      : nodeResolve({
          preferBuiltins: false,
          browser: true,
        });

  const externalsCopy = new Set<string>();
  // make all nested imports external from the same package
  for (const external of analyzedBundleInfo.externalDependencies) {
    if (external.startsWith('@')) {
      const [scope, name] = external.split('/', 3);
      externalsCopy.add(`${scope}/${name}`);
      externalsCopy.add(`${scope}/${name}/*`);
    } else {
      externalsCopy.add(external);
      externalsCopy.add(`${external}/*`);
    }
  }

  const externals = Array.from(externalsCopy);

  const normalizedEntryFile = slash(entryFile);
  return {
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    treeshake: 'smallest',
    preserveSymlinks: true,
    external: externals,
    plugins: [
      {
        name: 'alias-optimized-deps',
        resolveId(id: string) {
          if (!analyzedBundleInfo.dependencies.has(id)) {
            return null;
          }

          const filename = analyzedBundleInfo.dependencies.get(id)!;
          const absolutePath = join(workspaceRoot || projectRoot, filename);

          // During `mastra dev` we want to keep deps as external
          if (isDev) {
            return {
              id: process.platform === 'win32' ? pathToFileURL(absolutePath).href : absolutePath,
              external: true,
            };
          }

          // For production builds return the absolute path as-is so Rollup can handle itself
          return {
            id: absolutePath,
            external: false,
          };
        },
      } satisfies Plugin,
      alias({
        entries: [
          {
            find: /^\#server$/,
            replacement: slash(fileURLToPath(import.meta.resolve('@mastra/deployer/server'))),
          },
          {
            find: /^\@mastra\/server\/(.*)/,
            replacement: `@mastra/server/$1`,
            customResolver: id => {
              if (id.startsWith('@mastra/server')) {
                return {
                  id: fileURLToPath(import.meta.resolve(id)),
                };
              }
            },
          },
          { find: /^\#mastra$/, replacement: normalizedEntryFile },
        ],
      }),
      tsConfigPaths(),
      {
        name: 'tools-rewriter',
        resolveId(id: string) {
          if (id === '#tools') {
            return {
              id: './tools.mjs',
              external: true,
            };
          }
        },
      } satisfies Plugin,
      esbuild({
        platform,
        define: env,
      }),
      optimizeLodashImports({
        include: '**/*.{js,ts,mjs,cjs}',
      }),
      commonjs({
        extensions: ['.js', '.ts'],
        transformMixedEsModules: true,
        esmExternals(id) {
          return externals.includes(id);
        },
      }),
      enableEsmShim ? esmShim() : undefined,
      nodeResolvePlugin,
      // for debugging
      // {
      //   name: 'logger',
      //   //@ts-ignore
      //   resolveId(id, ...args) {
      //     console.log({ id, args });
      //   },
      //   // @ts-ignore
      // transform(code, id) {
      //   if (code.includes('class Duplexify ')) {
      //     console.log({ duplex: id });
      //   }
      // },
      // },
      json(),
      removeDeployer(entryFile, { sourcemap }),
      // treeshake unused imports
      esbuild({
        include: entryFile,
        platform,
      }),
    ].filter(Boolean),
  } satisfies InputOptions;
}

export async function createBundler(
  inputOptions: InputOptions,
  outputOptions: Partial<OutputOptions> & { dir: string },
) {
  const bundler = await rollup(inputOptions);

  return {
    write: () => {
      return bundler.write({
        ...outputOptions,
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      });
    },
    close: () => {
      return bundler.close();
    },
  };
}
