import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  deps: {
    alwaysBundle: ['@internal/core', '@internal/storage-test-utils'],
    neverBundle: ['@mastra/core'],
  },
  bundledTypes: ['@internal/core'],
});
