import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  treeshake: true,
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
