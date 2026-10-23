import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  deps: {
    alwaysBundle: ['@internal/core'],
    neverBundle: ['@mastra/core'],
  },
  bundledTypes: ['bson', '@internal/core'],
});
