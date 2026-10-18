import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/live/research.test.ts'],
    fileParallelism: false,
    testTimeout: 240_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
});
