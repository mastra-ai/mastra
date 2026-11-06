import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
