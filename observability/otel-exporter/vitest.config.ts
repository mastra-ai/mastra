import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/otel-exporter',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
