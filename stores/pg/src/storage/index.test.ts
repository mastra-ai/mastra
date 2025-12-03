import { createTestSuite } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import pgPromise from 'pg-promise';
import { afterAll, beforeAll, describe, vi } from 'vitest';
import { pgTests, TEST_CONFIG, connectionString } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Test with standard config
createTestSuite(new PostgresStore(TEST_CONFIG));

// Test with custom schema
createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: 'my_schema' }));

// Test with BYOC pool
describe('PostgresStore with BYOC pool', () => {
  let pool: Pool;
  let store: PostgresStore;

  beforeAll(() => {
    pool = new Pool({ connectionString });
    store = new PostgresStore({
      id: 'byoc-pool-test',
      pool,
      schemaName: 'byoc_pool_schema',
    });
  });

  afterAll(async () => {
    await store.close();
    await pool.end();
  });

  createTestSuite(store);
});

// Test with BYOC pg-promise client
describe('PostgresStore with BYOC pg-promise client', () => {
  let pgp: pgPromise.IMain;
  let client: pgPromise.IDatabase<{}>;
  let store: PostgresStore;

  beforeAll(() => {
    pgp = pgPromise();
    client = pgp(connectionString);
    store = new PostgresStore({
      id: 'byoc-client-test',
      client,
      schemaName: 'byoc_client_schema',
    });
  });

  afterAll(async () => {
    await store.close();
    pgp.end();
  });

  createTestSuite(store);
});

pgTests();
