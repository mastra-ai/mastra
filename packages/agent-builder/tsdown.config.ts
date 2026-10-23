import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  deps: {
    alwaysBundle: ['@internal/ai-sdk-v5'],
    neverBundle: ['typescript'],
  },
});
