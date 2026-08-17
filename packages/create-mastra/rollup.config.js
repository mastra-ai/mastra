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
  ],
  onwarn(warning, warn) {
    // Ignore specific warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'EVAL') return;
    warn(warning);
  },
  external: [...external],
});
