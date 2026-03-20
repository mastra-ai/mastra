import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/**/*.test.ts'],
    globalSetup: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    sequence: {
      concurrent: false,
    },
  },
});
