// Matches maxWorkers in vitest.config.ts; VITEST_POOL_ID runs 1..maxWorkers.
export const TEST_WORKER_COUNT = 4;

export const workerName = (worker: number | string) => `mastra_test_w${worker}`;

// Runs in each worker before test files import. Each worker connects as its own
// user whose default database is its own (created in vitest.global-setup.ts), so
// the `process.env.CLICKHOUSE_USERNAME ||` defaults in test files land there.
// A database in the URL would override tests that pass an explicit `database`.
if (process.env.VITEST_POOL_ID) {
  process.env.CLICKHOUSE_USERNAME = workerName(process.env.VITEST_POOL_ID);
}
