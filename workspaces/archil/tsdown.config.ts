import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  deps: {
    neverBundle: ['@mastra/core', 'disk'],
  },
});
