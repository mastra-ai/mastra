import { stripJsSourcemaps } from '@internal/types-builder/strip-js-sourcemaps';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  dts: true,
  plugins: [stripJsSourcemaps()],
  clean: true,
  deps: {
    neverBundle: ['@mastra/core'],
  },
});
