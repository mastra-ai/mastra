import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import nodeExternals from 'rollup-plugin-node-externals';
import pkgJson from './package.json' with { type: 'json' };

const external = ['commander', 'fs-extra', 'execa', 'prettier', 'posthog-node'];
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
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node', 'default', 'module', 'import'],
    }),
    esbuild({
      target: 'node20',
      sourceMap: true,
    }),
    nodeExternals(),
    commonjs(),
  ],
  external,
});