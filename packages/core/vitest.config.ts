import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    // Increase default timeout for tests that make real API calls to LLMs
    testTimeout: 120000, // 2 minutes default
  },
});
