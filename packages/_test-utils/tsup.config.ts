import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  // vitest must be external so hooks use the consumer's test runner instance
  external: ['vitest'],
});
