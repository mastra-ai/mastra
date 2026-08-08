import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:packages/rag',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
