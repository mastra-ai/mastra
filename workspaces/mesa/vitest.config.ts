import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    testTimeout: 30000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
