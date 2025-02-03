import { transform } from '@babel/core';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import builtins from 'builtins';
import { join } from 'path';
import { rollup, watch, type InputOptions, type Plugin, type InputOption } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import nodeExternals from 'rollup-plugin-node-externals';
import { fileURLToPath } from 'url';

import { FileService } from './fs';
import { telemetryFix } from './plugins/telemetry-fix';

type NormalizedInputOptions = Omit<Partial<InputOptions>, 'plugins' | 'input'> & {
  plugins?: Plugin[];
  input: InputOption;
};

function getOptions(inputOptions: NormalizedInputOptions): InputOptions {
  const fileService = new FileService();
  const entry = fileService.getFirstExistingFile([
    join(process.cwd(), 'src/mastra/index.ts'),
    join(process.cwd(), 'src/mastra/index.js'),
  ]);

  const nodeBuiltins = builtins({ version: '20.0.0' });
  console.log(nodeBuiltins);
  return {
    // logLevel: 'silent',
    ...inputOptions,
    treeshake: true,
    preserveSymlinks: true,
    external: [...nodeBuiltins, ...nodeBuiltins.map((builtin: string) => 'node:' + builtin)],
    plugins: [
      ...(inputOptions.plugins ?? []),
      telemetryFix(),
      alias({
        entries: [
          {
            find: /^\#server$/,
            replacement: fileURLToPath(import.meta.resolve('@mastra/deployer/server')).replaceAll('\\', '/'),
          },
          { find: /^\#mastra$/, replacement: entry.replaceAll('\\', '/') },
        ],
      }),
      {
        name: 'transformer',
        // @ts-ignore
        transform(code: string, id: string) {
          if (id.includes('@libsql') && code.includes('require')) {
            console.log({ toTransorm: id });
          }

          if (code.includes('process.env.LIBSQL_JS_DEV')) {
            return code.replace('process.env.LIBSQL_JS_DEV', '1==1');
          }
        },
      },
      commonjs({
        strictRequires: 'debug',
        // dynamicRequireTargets: ['node_modules/**/@libsql+win32-*/*'],
      }),
      {
        name: 'logger',
        // @ts-ignore
        resolveId(id) {
          console.log({ id });
        },
        // @ts-ignore
        transform(code, id) {
          if (code.includes('__commonJS')) {
            console.log({ x: id });
          }
        },
      },
      nodeResolve({
        preferBuiltins: true,
        exportConditions: ['node', 'import', 'require'],
        mainFields: ['module', 'main'],
        // dedupe: ['zod'],
      }),
      json(),
      esbuild({
        include: /\.tsx?$/, // default, inferred from `loaders` option
        exclude: /node_modules/, // default
        target: 'node20',
        platform: 'node',
        minify: false,
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
        },
      }),
    ].filter(Boolean),
  };
}

export async function getBundler(inputOptions: NormalizedInputOptions) {
  const bundle = await rollup(getOptions(inputOptions));

  return bundle;
}

export async function getWatcher(inputOptions: NormalizedInputOptions) {
  const watcher = watch(getOptions(inputOptions));

  return watcher;
}
