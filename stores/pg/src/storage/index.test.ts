import { createTestSuite } from '@internal/storage-test-utils';
import pgPromise from 'pg-promise';
import { afterAll, beforeAll, describe } from 'vitest';
import { vi } from 'vitest';
import { connectionString, pgTests, TEST_CONFIG } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createTestSuite(new PostgresStore(TEST_CONFIG));

// Test suite with custom schema - requires manual schema setup
describe('PostgresStore with custom schema', () => {
  const customSchemaName = 'my_schema';

  beforeAll(async () => {
    // Create a temporary pg-promise instance for setup
    const pgp = pgPromise();
    const db = pgp(connectionString);

    // Drop and recreate the schema for a clean test
    await db.none(`DROP SCHEMA IF EXISTS ${customSchemaName} CASCADE`);
    await db.none(`CREATE SCHEMA ${customSchemaName}`);

    // Don't call pgp.end() here - it will destroy the connection pool
    // which is shared by pg-promise instances, causing the test to fail
  });

  afterAll(async () => {
    // Create a fresh connection for cleanup
    const cleanupPgp = pgPromise();
    const cleanupDb = cleanupPgp(connectionString);

    try {
      await cleanupDb.none(`DROP SCHEMA IF EXISTS ${customSchemaName} CASCADE`);
    } finally {
      cleanupPgp.end();
    }
  });

  createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: customSchemaName }));
});

pgTests();
