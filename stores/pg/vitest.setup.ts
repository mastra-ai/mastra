export const workerDatabaseName = (worker: number | string) => `mastra_test_w${worker}`;

// Runs in each worker before test files import, so test-utils' TEST_CONFIG and the
// `process.env.DB_URL ||` defaults in test files point at this worker's database.
if (process.env.VITEST_POOL_ID) {
  const database = workerDatabaseName(process.env.VITEST_POOL_ID);
  process.env.POSTGRES_DB = database;
  process.env.DB_URL = `postgresql://postgres:postgres@localhost:5434/${database}`;
  process.env.POSTGRES_CONNECTION_STRING = process.env.DB_URL;
  process.env.PG_VNEXT_TIMESCALE_URL = `postgres://postgres:postgres@localhost:5435/${database}`;
}
