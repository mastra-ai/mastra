export const workerName = (worker: number | string) => `mastra_test_w${worker}`;

// Runs in each worker before test files import. Each worker connects as its own
// user whose default database is its own (created in vitest.global-setup.ts), so
// the `process.env.CLICKHOUSE_USERNAME ||` defaults in test files land there.
// Don't switch this to a database in CLICKHOUSE_URL: the URL database overrides
// an explicit `database` option, which breaks tests that create their own
// databases (feedback-deletion-races replicas, the database-fallback test).
if (process.env.VITEST_POOL_ID) {
  process.env.CLICKHOUSE_USERNAME = workerName(process.env.VITEST_POOL_ID);
}
