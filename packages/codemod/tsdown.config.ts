import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    treeshake: true,
    format: ['esm'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    dts: false,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/codemods/**/*.ts'],
    outDir: 'dist/codemods',
    format: ['esm'],
    dts: false,
    clean: true,
    sourcemap: true,
  },
]);
