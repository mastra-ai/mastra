import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { join } from 'path';
import { rollup, watch, type InputOptions, type Plugin, type InputOption } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
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

  return {
    logLevel: 'silent',
    ...inputOptions,
    treeshake: true,
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
      commonjs(),
      nodeResolve({}),
      json(),
      esbuild({
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
