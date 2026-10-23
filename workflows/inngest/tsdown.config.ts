import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/connect.ts'],
  deps: {
    alwaysBundle: ['@internal/core'],
  },
  bundledTypes: ['@internal/core'],
});
