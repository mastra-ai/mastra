import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    treeshake: true,
    format: ['cjs'],
    dts: false,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/codemods/**/*.ts'],
    outDir: 'dist/codemods',
    format: ['cjs'],
    dts: false,
    clean: true,
    sourcemap: true,
  },
]);
