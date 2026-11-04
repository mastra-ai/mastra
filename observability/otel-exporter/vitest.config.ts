import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/otel-exporter',
    // tracing.test.ts mocks the SDK; transport tests need the real implementations.
    isolate: true,
    globals: true,
    environment: 'node',
  },
});
