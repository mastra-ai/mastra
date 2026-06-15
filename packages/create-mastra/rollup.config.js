import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import nodeExternals from 'rollup-plugin-node-externals';
import pkgJson from './package.json' with { type: 'json' };

const external = ['commander', 'tinyexec', 'posthog-node', 'pino', 'pino-pretty'];
external.forEach(pkg => {
  if (!pkgJson.dependencies[pkg]) {
    throw new Error(`${pkg} is not in the dependencies of create-mastra`);
  }
});

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist/',
    format: 'esm',
    sourcemap: true,
  },
  treeshake: true,
  plugins: [
    json(),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    esbuild({
      target: 'node22',
      sourceMap: true,
    }),
    nodeExternals(),
    commonjs(),
    {
      name: 'copy-starter-files',
      buildEnd: async () => {
        const mastraPath = path.dirname(fileURLToPath(import.meta.resolve('mastra/package.json')));

        // Copy to dist directory instead of root
        await fsPromises.cp(path.join(mastraPath, 'dist', 'starter-files'), './dist/starter-files', {
          recursive: true,
        });
        await fsPromises.cp(path.join(mastraPath, 'dist', 'templates'), './dist/templates', { recursive: true });
      },
    },
  ],
  onwarn(warning, warn) {
    // Ignore specific warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'EVAL') return;
    warn(warning);
  },
  external: [...external],
});
