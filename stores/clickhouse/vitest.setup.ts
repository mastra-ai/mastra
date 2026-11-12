export const workerName = (worker: number | string) => `mastra_test_w${worker}`;

// Runs in each worker before test files import. Each worker connects as its own
// user whose default database is its own (created in vitest.global-setup.ts), so
// the `process.env.CLICKHOUSE_USERNAME ||` defaults in test files land there.
// A database in the CLICKHOUSE_URL path overrides both the user's
// default database and an explicit `database` option, which would put every
// worker in one database and break tests that create their own databases
// (feedback-deletion-races replicas, the database-fallback test). Strip it.
if (process.env.VITEST_POOL_ID) {
  process.env.CLICKHOUSE_USERNAME = workerName(process.env.VITEST_POOL_ID);
  if (process.env.CLICKHOUSE_URL) {
    const url = new URL(process.env.CLICKHOUSE_URL);
    url.pathname = '/';
    process.env.CLICKHOUSE_URL = url.toString();
  }
}
