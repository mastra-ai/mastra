import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts'],
    testTimeout: 5 * 60 * 1000,
    hookTimeout: 10 * 60 * 1000,
    globalSetup: './setup.ts',
  },
});
