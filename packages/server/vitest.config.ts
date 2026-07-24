import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/server',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['@internal/test-utils/setup'],
  },
});
