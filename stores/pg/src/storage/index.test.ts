import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createStoreIndexTests,
  createDomainIndexTests,
} from '@internal/storage-test-utils';
import { TABLE_THREADS } from '@mastra/core/storage';
import { Pool } from 'pg';
import { describe, it, expect, vi } from 'vitest';

import { MemoryPG } from './domains/memory';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';
import { pgTests, TEST_CONFIG, connectionString } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createTestSuite(new PostgresStore(TEST_CONFIG));
createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: 'my_schema' }));

// Helper to create a pre-configured pg.Pool
const createTestPool = () => {
  return new Pool({ connectionString });
};

// Pre-configured pool acceptance tests
createClientAcceptanceTests({
  storeName: 'PostgresStore',
  expectedStoreName: 'PostgresStore',
  createStoreWithClient: () => {
    const pool = createTestPool();
    return new PostgresStore({
      id: 'pg-pool-test',
      pool,
    });
  },
});

// Domain-level pre-configured pool tests
createDomainDirectTests({
  storeName: 'PostgreSQL',
  createMemoryDomain: () => {
    const pool = createTestPool();
    return new MemoryPG({ pool });
  },
  createWorkflowsDomain: () => {
    const pool = createTestPool();
    return new WorkflowsPG({ pool });
  },
  createScoresDomain: () => {
    const pool = createTestPool();
    return new ScoresPG({ pool });
  },
});

// Configuration validation tests
createConfigValidationTests({
  storeName: 'PostgresStore',
  createStore: config => new PostgresStore(config as any),
  validConfigs: [
    {
      description: 'valid host-based config',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      },
    },
    {
      description: 'valid connection string',
      config: { id: 'test-store', connectionString: 'postgresql://user:pass@localhost/db' },
    },
    {
      description: 'config with schemaName',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'connectionString with schemaName',
      config: {
        id: 'test-store',
        connectionString: 'postgresql://user:pass@localhost/db',
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'pre-configured pg.Pool',
      config: { id: 'test-store', pool: createTestPool() },
    },
    {
      description: 'pool with schemaName',
      config: { id: 'test-store', pool: createTestPool(), schemaName: 'custom_schema' },
    },
    {
      description: 'disableInit with host config',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with pool',
      config: { id: 'test-store', pool: createTestPool(), disableInit: true },
    },
    {
      description: 'connectionString with ssl: true',
      config: { id: 'test-store', connectionString: 'postgresql://user:pass@localhost/db', ssl: true },
    },
    {
      description: 'host config with ssl object',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      description: 'host config with pool options',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        max: 30,
        idleTimeoutMillis: 60000,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty connectionString',
      config: { id: 'test-store', connectionString: '' },
      expectedError: /connectionString must be provided and cannot be empty/i,
    },
    {
      description: 'empty host',
      config: { id: 'test-store', host: '', port: 5432, database: 'test', user: 'test', password: 'test' },
      expectedError: /host must be provided/i,
    },
    {
      description: 'empty database',
      config: { id: 'test-store', host: 'localhost', port: 5432, database: '', user: 'test', password: 'test' },
      expectedError: /database must be provided/i,
    },
    {
      description: 'empty user',
      config: { id: 'test-store', host: 'localhost', port: 5432, database: 'test', user: '', password: 'test' },
      expectedError: /user must be provided/i,
    },
    {
      description: 'empty password',
      config: { id: 'test-store', host: 'localhost', port: 5432, database: 'test', user: 'test', password: '' },
      expectedError: /password must be provided/i,
    },
    {
      description: 'missing required fields',
      config: { id: 'test-store', user: 'test' },
      expectedError: /invalid config.*Provide either.*pool.*connectionString.*host/i,
    },
    {
      description: 'completely empty config',
      config: { id: 'test-store' },
      expectedError: /invalid config.*Provide either.*pool.*connectionString.*host/i,
    },
  ],
});

// PG-specific tests (public fields, table quoting, permissions, function namespace, timestamp fallback, Cloud SQL, etc.)
pgTests();

// Helper to check if a PostgreSQL index exists in a specific schema
const pgIndexExists = async (store: PostgresStore, namePattern: string): Promise<boolean> => {
  // PostgresStore exposes schema through .schema property
  const schemaName = (store as any).schema || 'public';
  const result = await store.db.oneOrNone<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname ILIKE $2) AS exists`,
    [schemaName, `%${namePattern}%`],
  );
  return result?.exists === true;
};

// Store-level index configuration tests
// Uses unique schema names to avoid index collision between tests
const storeTestId = Math.floor(Date.now() / 1000) % 100000; // Short unique ID
createStoreIndexTests({
  storeName: 'PostgresStore',
  createDefaultStore: () =>
    new PostgresStore({ ...TEST_CONFIG, id: 'pg-idx-default', schemaName: `idx_s_${storeTestId}_d` }),
  createStoreWithSkipDefaults: () =>
    new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-idx-skip',
      schemaName: `idx_s_${storeTestId}_s`,
      skipDefaultIndexes: true,
    }),
  createStoreWithCustomIndexes: indexes =>
    new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-idx-custom',
      schemaName: `idx_s_${storeTestId}_c`,
      indexes: indexes as any,
    }),
  createStoreWithInvalidTable: indexes =>
    new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-idx-invalid',
      schemaName: `idx_s_${storeTestId}_i`,
      indexes: indexes as any,
    }),
  indexExists: (store, pattern) => pgIndexExists(store as PostgresStore, pattern),
  defaultIndexPattern: 'threads_resourceid_createdat',
  customIndexName: 'custom_pg_test_idx',
  customIndexDef: {
    name: 'custom_pg_test_idx',
    table: TABLE_THREADS,
    columns: ['title'],
  },
  invalidTableIndexDef: {
    name: 'invalid_table_idx',
    table: 'nonexistent_table_xyz',
    columns: ['id'],
  },
});

// Domain-level index configuration tests (using MemoryPG as representative)
// Uses unique schema names to avoid index collision between tests
const domainTestId = (Math.floor(Date.now() / 1000) % 100000) + 1; // Short unique ID (different from store)
let currentDomainTestSchema = '';

createDomainIndexTests({
  domainName: 'MemoryPG',
  createDefaultDomain: () => {
    currentDomainTestSchema = `idx_d_${domainTestId}_d`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema });
  },
  createDomainWithSkipDefaults: () => {
    currentDomainTestSchema = `idx_d_${domainTestId}_s`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema, skipDefaultIndexes: true });
  },
  createDomainWithCustomIndexes: indexes => {
    currentDomainTestSchema = `idx_d_${domainTestId}_c`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema, indexes: indexes as any });
  },
  createDomainWithInvalidTable: indexes => {
    currentDomainTestSchema = `idx_d_${domainTestId}_i`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema, indexes: indexes as any });
  },
  indexExists: async (_domain, pattern) => {
    // Create a fresh pool to check indexes
    const pool = createTestPool();
    try {
      const result = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname ILIKE $2) AS exists`,
        [currentDomainTestSchema, `%${pattern}%`],
      );
      return result.rows[0]?.exists === true;
    } finally {
      await pool.end();
    }
  },
  defaultIndexPattern: 'threads_resourceid_createdat',
  customIndexName: 'custom_memory_test_idx',
  customIndexDef: {
    name: 'custom_memory_test_idx',
    table: TABLE_THREADS,
    columns: ['title'],
  },
  invalidTableIndexDef: {
    name: 'invalid_domain_table_idx',
    table: 'nonexistent_table_xyz',
    columns: ['id'],
  },
});

// Pool integration tests
describe('PostgresStore pool integration', () => {
  it('should expose the same pool instance that was passed in', async () => {
    const pool = createTestPool();
    const store = new PostgresStore({ id: 'pool-test', pool });
    expect(store.pool).toBe(pool);
    await pool.end();
  });

  it('should not close a passed-in pool when close() is called', async () => {
    const pool = createTestPool();
    const store = new PostgresStore({ id: 'shared-pool-test', pool });

    await store.close();

    // Pool should still be usable after store.close()
    const result = await pool.query('SELECT 1 as test');
    expect(result.rows[0].test).toBe(1);

    await pool.end();
  });

  it('should close pool when close() is called on internally-created pool', async () => {
    const store = new PostgresStore({
      id: 'close-test',
      connectionString,
    });

    expect(store.pool).toBeDefined();
    await store.close();

    // Pool should be closed now
    await expect(store.pool.query('SELECT 1')).rejects.toThrow();
  });
});
