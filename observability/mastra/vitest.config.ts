import { defineConfig } from '@internal/lint/vitest';

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
  },
});
