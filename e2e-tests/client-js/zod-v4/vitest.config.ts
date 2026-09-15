import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    globalSetup: './setup.ts',
    // Test files share one server; memory and observability suites both call
    // /e2e/reset-storage, so parallel files can wipe each other's data mid-run.
    fileParallelism: false,
  },
});
