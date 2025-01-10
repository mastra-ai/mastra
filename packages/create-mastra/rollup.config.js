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
  // mode: 'production',
  // plugins: [
  //   externalizeDeps({
  //     nodeBuiltins: true,
  //     nodeBuiltins: true,
  //     except: ['mastra'],
  //   }),
  // ],
  // build: {
  //   minify: false,
  //   sourcemap: true,
  //   target: 'esnext',

  //   lib: {
  //     entry: resolve(__dirname, 'src/index.ts'),
  //     // name: 'CreateMastra',
  //     formats: ['es'],
  //   },
  //   rollupOptions: {
  //     output: {
  //       preserveModules: true,
  //     },
  //   },
  // },
});
// target: 'node',
// ssr: {
//   // SSR-specific config
//   target: 'node',
//   noExternal: ['mastra'], // Bundle mastra dependency
// },
// build: {
//   target: 'node20', // Match engine requirement from package.json
//   minify: false, // Avoid minification for better debugging
//   sourcemap: true,
//   rollupOptions: {
//     output: {
//       format: 'esm', // Match "type": "module" from package.json
//     },
//   },
// },
