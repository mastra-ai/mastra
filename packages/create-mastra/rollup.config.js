import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import nodeExternals from 'rollup-plugin-node-externals';
import pkgJson from './package.json' with { type: 'json' };
import fsExtra from 'fs-extra/esm';
import path from 'path';
import { fileURLToPath } from 'url';

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
    {
      name: 'copy-starter-files',
      buildEnd: async () => {
        await fsExtra.remove('./starter-files')
        
        const mastraPath = path.dirname(fileURLToPath(import.meta.resolve('mastra/package.json')))
        await fsExtra.copy(path.join(mastraPath, 'dist', 'starter-files'), './starter-files')
      },
    },
  ],
  external,
});