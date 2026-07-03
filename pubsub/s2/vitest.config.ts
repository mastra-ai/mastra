import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:pubsub/s2',
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
