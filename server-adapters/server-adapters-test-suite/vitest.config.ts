import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server-adapters-test-suite',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
