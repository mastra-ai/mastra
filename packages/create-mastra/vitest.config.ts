import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/create-mastra',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: true,
  },
});
