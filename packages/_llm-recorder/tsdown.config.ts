import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/vite-plugin.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: true,
  treeshake: true,
  sourcemap: true,
  // vitest must be external so hooks use the consumer's test runner instance
  deps: {
    neverBundle: ['vitest', 'vite'],
  },
});
