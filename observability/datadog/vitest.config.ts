import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/datadog',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
