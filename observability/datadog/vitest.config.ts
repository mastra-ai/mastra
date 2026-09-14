import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/datadog',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./tests/reset-modules.ts'],
  },
});
