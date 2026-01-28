import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Exclude Gemini tests from main test suite - they are flaky due to API issues
    // Run them separately with: pnpm test:gemini
    exclude: ['src/**/*.gemini.test.ts', '**/node_modules/**'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    // Increase default timeout for tests that make real API calls to LLMs
    testTimeout: 120000, // 2 minutes default
  },
});
