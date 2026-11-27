import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/otel-exporter',
    // tracing.test.ts mocks the SDK; transport tests need the real implementations.
    isolate: true,
    globals: true,
    environment: 'node',
  },
});
