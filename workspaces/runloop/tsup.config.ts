import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: {
    resolve: true,
  },
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  external: ['@mastra/core', '@runloop/api-client'],
});
