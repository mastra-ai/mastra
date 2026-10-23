import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.live.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
