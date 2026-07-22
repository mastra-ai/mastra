import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  dts: true,
  clean: true,
  sourcemap: true,
  deps: {
    neverBundle: ['@mastra/core'],
  },
});
