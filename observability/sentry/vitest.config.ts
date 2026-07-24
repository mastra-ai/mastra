import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:observability/sentry',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
