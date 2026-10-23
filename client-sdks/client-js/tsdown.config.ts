import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  bundledTypes: ['@ai-sdk/*', '@internal/ai-sdk-v4', '@internal/ai-sdk-v5'],
});
