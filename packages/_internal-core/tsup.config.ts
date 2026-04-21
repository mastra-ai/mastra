import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/storage/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
});
