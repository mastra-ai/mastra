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
    // Pre-download the inngest-cli dev-server binary before any test runs, so the
    // one-time ~100MB download isn't subject to per-test or hook timeouts.
    globalSetup: ['src/__tests__/global-setup.ts'],
    // Inngest SDK v4 defaults to "cloud" mode and requires an event key unless
    // `isDev: true`, `INNGEST_DEV` env var, or an explicit dev URL is set.
    // Tests use a local dev server; force dev mode for every Inngest client.
    env: {
      INNGEST_DEV: '1',
    },
  },
});
