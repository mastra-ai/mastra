import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:observability/grafana',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
