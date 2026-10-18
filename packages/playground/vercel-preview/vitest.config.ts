import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    name: 'unit:packages/playground/vercel-preview',
    environment: 'node',
    include: ['src/mastra/seed/__tests__/*.test.ts'],
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
