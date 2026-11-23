import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  dts: { sourcemap: false },
  clean: true,
  treeshake: true,
  deps: {
    neverBundle: ['@mastra/agent-browser', '@mastra/core', '@mastra/core/browser', 'firecrawl'],
  },
});
