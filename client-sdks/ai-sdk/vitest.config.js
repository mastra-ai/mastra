import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:client-sdks/ai-sdk',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
