import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/braintrust',
    // tracing.test.ts (automock) and tracing.early-data.test.ts (factory mock) mock
    // 'braintrust' differently. Without isolation the shared module binds to whichever
    // file loaded first, making the mock miss in other files and causing
    // order-dependent CI failures.
    isolate: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
