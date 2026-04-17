import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['ee/src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  sourcemap: true,
});
