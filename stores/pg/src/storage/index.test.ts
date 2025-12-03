import { createTestSuite } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, describe, vi } from 'vitest';
import { pgTests, TEST_CONFIG, connectionString } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Test with standard config
createTestSuite(new PostgresStore(TEST_CONFIG));

// Test with custom schema
createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: 'my_schema' }));

// Test with BYOC pool
describe('PostgresStore with BYOC pool', () => {
  // Initialize at describe block level so it's available when createTestSuite runs
  const pool = new Pool({ connectionString, allowExitOnIdle: true });
  const store = new PostgresStore({
    id: 'byoc-pool-test',
    pool,
    schemaName: 'byoc_pool_schema',
  });

  afterAll(async () => {
    await store.close();
    await pool.end();
  });

  createTestSuite(store);
});

pgTests();
