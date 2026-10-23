import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  deps: {
    neverBundle: ['@mastra/core', '@mastra/e2b', '@e2b/desktop', 'e2b'],
  },
});
