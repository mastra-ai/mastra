import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'public-exports.test.ts'],
    // Increase default timeout for tests that make real API calls to LLMs
    testTimeout: 120000, // 2 minutes default
    server: {
      deps: {
        inline: ['vitest-package-exports'],
      },
    },
  },
});
