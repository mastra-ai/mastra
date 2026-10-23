import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/server/index.ts', 'src/schema.ts'],
  deps: {
    alwaysBundle: ['@internal/core'],
    neverBundle: ['@mastra/core'],
  },
  bundledTypes: ['@internal/core'],
});
