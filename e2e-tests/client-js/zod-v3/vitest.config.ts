import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    globalSetup: './setup.ts',
  },
});
