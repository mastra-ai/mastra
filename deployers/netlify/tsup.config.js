import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  treeshake: true,
  format: 'esm',
  dts: true,
  clean: true,
});
