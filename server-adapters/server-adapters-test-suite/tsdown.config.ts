import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  deps: {
    // Vitest must be external so the suites use the consumer's test runner instance.
    neverBundle: ['vitest'],
  },
});
