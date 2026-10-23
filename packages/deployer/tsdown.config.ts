import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: [
    'src/index.ts',
    'src/build/index.ts',
    'src/server/index.ts',
    'src/services/index.ts',
    'src/bundler/index.ts',
    'src/build/analyze.ts',
    'src/validator/loader.ts',
    'src/build/bundler.ts',
    'src/validator/custom-resolver.ts',
  ],
  deps: {
    alwaysBundle: ['@hono/node-server', '@internal/core', '@mastra/hono'],
  },
  bundledTypes: ['@hono/node-server', '@internal/core', '@mastra/hono'],
});
