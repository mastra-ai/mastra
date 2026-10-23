import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  deps: {
    alwaysBundle: ['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', '@internal/ai-v6'],
  },
  bundledTypes: ['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', '@internal/ai-v6'],
});
