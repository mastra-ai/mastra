import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
  },
  deps: {
    alwaysBundle: ['@internal/core'],
    neverBundle: ['@mastra/core'],
  },
  bundledTypes: ['@internal/core'],
});
