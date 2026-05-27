import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_internals/auth',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['@internal/test-utils/setup'],
    testTimeout: 120000,
  },
});
