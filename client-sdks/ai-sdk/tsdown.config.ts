import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/ui.ts'],
  deps: {
    alwaysBundle: ['@internal/ai-sdk-v5', '@internal/ai-v6', '@internal/ai-v7'],
  },
  bundledTypes: [
    '@ai-sdk/*',
    '@internal/ai-sdk-v4',
    '@internal/ai-sdk-v5',
    '@internal/ai-v6',
    '@internal/ai-v7',
    'json-schema',
  ],
});
