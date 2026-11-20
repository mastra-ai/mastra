import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['npm-import.test.ts'],
    globalSetup: ['./setup.ts'],
    testTimeout: 60 * 1000,
  },
});
