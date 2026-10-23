import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  bundledTypes: ['@internal/ai-sdk-v5'],
});
