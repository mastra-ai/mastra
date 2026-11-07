import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:pubsub/redis-streams',
    globals: true,
    include: ['src/**/*.test.ts'],
    // CI splits the slow durability suites test by test (see vitest.test-shard.ts).
    setupFiles: process.env.VITEST_TEST_SHARD ? ['./vitest.test-shard.ts'] : [],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
