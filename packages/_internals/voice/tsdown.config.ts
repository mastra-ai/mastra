import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/voice/index.ts', 'src/voice/aisdk/index.ts', 'src/routes/index.ts'],
  bundledTypes: ['@internal/core', '@internal/ai-sdk-v5', 'zod'],
});
