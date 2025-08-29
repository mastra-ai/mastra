import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 120000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
    reporters: 'dot',
    bail: 1,
  },
});
