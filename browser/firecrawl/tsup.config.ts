import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: 'smallest',
  external: [
    '@mastra/agent-browser',
    '@mastra/core',
    '@mastra/core/browser',
    'agent-browser',
    '@mendable/firecrawl-js',
  ],
});
