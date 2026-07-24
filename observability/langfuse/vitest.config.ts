import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/langfuse',
    // tracing.test.ts and tracing.converter.test.ts mock '@langfuse/otel' differently;
    // without isolation the shared module binds to whichever file loaded first.
    isolate: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
