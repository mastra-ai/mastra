import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:pubsub/redis-streams',
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
