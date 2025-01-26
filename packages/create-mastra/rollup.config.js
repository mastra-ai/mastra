import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import nodeExternals from 'rollup-plugin-node-externals';
import pkgJson from './package.json' with { type: 'json' };
import fsExtra from 'fs-extra/esm';
import path from 'path';
import { fileURLToPath } from 'url';

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
      exportConditions: ['node', 'default', 'module', 'import'],
    }),
    esbuild({
      target: 'node20',
      sourceMap: true,
    }),
    nodeExternals(),
    commonjs(),
    {
      name: 'copy-starter-files',
      buildEnd: async () => {
        await fsExtra.remove('./starter-files')
        
        const mastraPath = path.dirname(fileURLToPath(import.meta.resolve('mastra/package.json')))
        await fsExtra.copy(path.join(mastraPath, 'dist', 'starter-files'), './starter-files')
      },
    },
  ],
  onwarn(warning, warn) {
    // Ignore specific warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'EVAL') return;
    warn(warning);
  },
  external: [
    'commander', 
    'fs-extra', 
    'execa', 
    'prettier', 
    'posthog-node',
    // External dependencies that don't need bundling
    /^@opentelemetry\/.*$/,
  ],
});