import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'server-adapters-test-suite',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
