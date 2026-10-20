import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/live/first-run.test.ts'],
    fileParallelism: false,
    testTimeout: 600000,
    hookTimeout: 60000,
    reporters: ['default'],
  },
});
