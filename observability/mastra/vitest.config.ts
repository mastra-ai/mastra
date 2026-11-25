import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/mastra',
    // Isolate test files: exporter tests mock `@mastra/core/utils` (fetchWithRetry),
    // which is consumed by modules shared across files (e.g. auth-failure-cooldown).
    // Without isolation the shared module binds to whichever file loaded first,
    // making the mock miss in other files and causing order-dependent CI failures.
    isolate: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // Keep cost estimates on the bundled snapshot; `pricing-registry.test.ts` turns refresh on per test.
      MASTRA_AUTO_REFRESH_PRICING: 'false',
      // Tests that set MASTRA_DEV must not start core's live registry refresh, which rewrites packages/core/dist.
      MASTRA_AUTO_REFRESH_PROVIDERS: 'false',
    },
  },
});
