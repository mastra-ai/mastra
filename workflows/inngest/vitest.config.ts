import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 60000, // Some tests call execute() multiple times, each takes ~15s
    hookTimeout: 30000, // Allow more time for beforeAll to setup Inngest
    fileParallelism: false,
    retry: 2, // Retry flaky tests up to 2 times (Inngest dev server can be flaky)
  },
});
