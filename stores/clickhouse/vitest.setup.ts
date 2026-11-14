export const workerName = (worker: number | string) => `mastra_test_w${worker}`;

// The password every worker user is created with (vitest.global-setup.ts) and connects with.
export const workerPassword = () => process.env.CLICKHOUSE_PASSWORD || 'password';

// Runs in each worker before test files import. Each worker connects as its own
// user whose default database is its own (created in vitest.global-setup.ts), so
// the `process.env.CLICKHOUSE_USERNAME ||` defaults in test files land there.
// A database in the CLICKHOUSE_URL path overrides both the user's
// default database and an explicit `database` option, which would put every
// worker in one database and break tests that create their own databases
// (feedback-deletion-races replicas, the database-fallback test). Strip it.
// Credentials in the URL likewise override the explicit username and password,
// so every worker would log in as the URL's user; strip those too. The URL user
// stays the admin that global setup provisions the worker users with.
if (process.env.VITEST_POOL_ID) {
  process.env.CLICKHOUSE_USERNAME = workerName(process.env.VITEST_POOL_ID);
  process.env.CLICKHOUSE_PASSWORD = workerPassword();
  if (process.env.CLICKHOUSE_URL) {
    const url = new URL(process.env.CLICKHOUSE_URL);
    url.pathname = '/';
    url.username = '';
    url.password = '';
    process.env.CLICKHOUSE_URL = url.toString();
  }
}
