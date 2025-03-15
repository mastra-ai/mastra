import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { builtinModules } from 'node:module';
import { join } from 'path';
import { rollup, watch, type InputOptions, type Plugin, type InputOption } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { fileURLToPath } from 'url';

import { FileService } from './fs';
import { removeDeployer } from './plugins/remove-deployer';

type NormalizedInputOptions = Omit<Partial<InputOptions>, 'plugins' | 'input' | 'external'> & {
  plugins?: Plugin[];
  input: InputOption;
  external?: (string | RegExp)[];
};

function getOptions(inputOptions: NormalizedInputOptions, platform: 'node' | 'browser', root: string): InputOptions {
  const fileService = new FileService();
  const entry = fileService.getFirstExistingFile([
    join(root, 'src/mastra/index.ts'),
    join(root, 'src/mastra/index.js'),
  ]);

  const nodeBuiltins = platform === 'node' ? builtinModules : [];

  let nodeResolvePlugin =
    platform === 'node'
      ? nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node', 'import', 'require'],
          mainFields: ['module', 'main'],
        })
      : nodeResolve({
          preferBuiltins: false,
          exportConditions: ['browser', 'import', 'require'],
          mainFields: ['module', 'main'],
          browser: true,
        });

  return {
    logLevel: 'silent',
    ...inputOptions,
    treeshake: 'smallest',
    preserveSymlinks: true,
    external: [
      ...nodeBuiltins,
      ...nodeBuiltins.map((builtin: string) => 'node:' + builtin),
      ...(inputOptions.external ?? []),
    ],
    plugins: [
      ...(inputOptions.plugins ?? []),
      alias({
        entries: [
          {
            find: /^\#server$/,
            replacement: fileURLToPath(import.meta.resolve('@mastra/deployer/server')).replaceAll('\\', '/'),
          },
          { find: /^\#mastra$/, replacement: entry.replaceAll('\\', '/') },
          {
            find: /^hono\//,
            replacement: 'hono/',
            customResolver: (id: string, importer: string | undefined) => {
              if (!importer?.startsWith('\x00virtual')) {
                return null;
              }

              const path = import.meta.resolve(id);
              return fileURLToPath(path);
            },
          },
        ],
      }),
      commonjs({
        strictRequires: 'strict',
        transformMixedEsModules: true,
        // dynamicRequireTargets: ['node_modules/**/@libsql+win32-*/*'],
      }),
      // for debugging
      // {
      //   name: 'logger',
      //   // @ts-ignore
      //   resolveId(id, ...args) {
      //     console.log({ id, args });
      //   },
      // },
      nodeResolvePlugin,
      json(),
      esbuild({
        include: /\.tsx?$/,
        target: 'node20',
        platform,
        minify: false,
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
        },
      }),
      removeDeployer(entry),
      esbuild({
        include: entry,
        target: 'node20',
        platform,
        minify: false,
      }),
    ].filter(Boolean),
  };
}

export async function getBundler(
  inputOptions: NormalizedInputOptions,
  args: {
    platform?: 'node' | 'browser';
    dir?: string;
  } = {},
) {
  const { platform = 'node', dir = process.cwd() } = args;
  const bundle = await rollup(getOptions(inputOptions, platform, dir));

  return bundle;
}

export async function getWatcher(
  inputOptions: NormalizedInputOptions,
  args: {
    platform?: 'node' | 'browser';
    dir?: string;
  } = {},
) {
  const { platform = 'node', dir = process.cwd() } = args;
  const watcher = watch(getOptions(inputOptions, platform, dir));

  return watcher;
}
