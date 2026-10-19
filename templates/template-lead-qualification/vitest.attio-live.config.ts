import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/live/attio.test.ts'],
    fileParallelism: false,
    testTimeout: 1_800_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
});
