import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/vite-plugin.ts'],
  dts: true,
  // vitest must be external so hooks use the consumer's test runner instance
  deps: {
    neverBundle: ['vitest', 'vite'],
  },
});
