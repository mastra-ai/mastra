import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Google Gemini integration tests.
 *
 * These tests are isolated from the main test suite because they
 * tend to be flaky due to API rate limits, model availability issues,
 * and other transient failures from the Google Generative AI API.
 *
 * Run these tests separately with: pnpm test:gemini
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.gemini.test.ts'],
    typecheck: {
      enabled: false,
    },
    // Increase default timeout for tests that make real API calls to LLMs
    testTimeout: 120000, // 2 minutes default
    // Retry flaky tests
    retry: 1,
  },
});
