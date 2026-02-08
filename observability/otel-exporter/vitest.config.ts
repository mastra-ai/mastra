import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/otel-exporter',
    isolate: false,
    globals: true,
    environment: 'node',
  },
});
