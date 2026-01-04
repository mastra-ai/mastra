import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createStoreIndexTests,
  createDomainIndexTests,
} from '@internal/storage-test-utils';
import { TABLE_THREADS } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { MemoryDSQL } from './domains/memory';
import { ScoresDSQL } from './domains/scores';
import { WorkflowsDSQL } from './domains/workflows';
import { dsqlTests, TEST_CONFIG, canRunDSQLTests, createTestPool } from './test-utils';
import { DSQLStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Run integration tests only when DSQL_HOST is set and DSQL_INTEGRATION=true
if (canRunDSQLTests()) {
  createTestSuite(new DSQLStore(TEST_CONFIG));

  // Pre-configured client acceptance tests
  createClientAcceptanceTests({
    storeName: 'DSQLStore',
    expectedStoreName: 'DSQLStore',
    createStoreWithClient: () => {
      const pool = createTestPool();
      return new DSQLStore({
        id: 'dsql-client-test',
        host: TEST_CONFIG.host,
        pool,
      });
    },
  });

  // Domain-level pre-configured client tests
  createDomainDirectTests({
    storeName: 'DSQL',
    createMemoryDomain: () => {
      const pool = createTestPool();
      return new MemoryDSQL({ pool });
    },
    createWorkflowsDomain: () => {
      const pool = createTestPool();
      return new WorkflowsDSQL({ pool });
    },
    createScoresDomain: () => {
      const pool = createTestPool();
      return new ScoresDSQL({ pool });
    },
  });

  // DSQL-specific tests (public fields, OCC retry, IAM auth, etc.)
  dsqlTests();

  // Helper to check if a DSQL/PostgreSQL index exists in a specific schema
  const dsqlIndexExists = async (store: DSQLStore, namePattern: string): Promise<boolean> => {
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
    storeName: 'DSQLStore',
    createDefaultStore: () =>
      new DSQLStore({ ...TEST_CONFIG, id: 'dsql-idx-default', schemaName: `idx_s_${storeTestId}_d` }),
    createStoreWithSkipDefaults: () =>
      new DSQLStore({
        ...TEST_CONFIG,
        id: 'dsql-idx-skip',
        schemaName: `idx_s_${storeTestId}_s`,
        skipDefaultIndexes: true,
      }),
    createStoreWithCustomIndexes: indexes =>
      new DSQLStore({
        ...TEST_CONFIG,
        id: 'dsql-idx-custom',
        schemaName: `idx_s_${storeTestId}_c`,
        indexes: indexes as any,
      }),
    createStoreWithInvalidTable: indexes =>
      new DSQLStore({
        ...TEST_CONFIG,
        id: 'dsql-idx-invalid',
        schemaName: `idx_s_${storeTestId}_i`,
        indexes: indexes as any,
      }),
    indexExists: (store, pattern) => dsqlIndexExists(store as DSQLStore, pattern),
    defaultIndexPattern: 'threads_resourceid_createdat',
    customIndexName: 'custom_dsql_test_idx',
    customIndexDef: {
      name: 'custom_dsql_test_idx',
      table: TABLE_THREADS,
      columns: ['title'],
    },
    invalidTableIndexDef: {
      name: 'invalid_table_idx',
      table: 'nonexistent_table_xyz',
      columns: ['id'],
    },
  });

  // Domain-level index configuration tests (using MemoryDSQL as representative)
  // Uses unique schema names to avoid index collision between tests
  const domainTestId = (Math.floor(Date.now() / 1000) % 100000) + 1; // Short unique ID (different from store)
  let currentDomainTestSchema = '';

  createDomainIndexTests({
    domainName: 'MemoryDSQL',
    createDefaultDomain: () => {
      currentDomainTestSchema = `idx_d_${domainTestId}_d`;
      const pool = createTestPool();
      return new MemoryDSQL({ pool, schemaName: currentDomainTestSchema });
    },
    createDomainWithSkipDefaults: () => {
      currentDomainTestSchema = `idx_d_${domainTestId}_s`;
      const pool = createTestPool();
      return new MemoryDSQL({ pool, schemaName: currentDomainTestSchema, skipDefaultIndexes: true });
    },
    createDomainWithCustomIndexes: indexes => {
      currentDomainTestSchema = `idx_d_${domainTestId}_c`;
      const pool = createTestPool();
      return new MemoryDSQL({ pool, schemaName: currentDomainTestSchema, indexes: indexes as any });
    },
    createDomainWithInvalidTable: indexes => {
      currentDomainTestSchema = `idx_d_${domainTestId}_i`;
      const pool = createTestPool();
      return new MemoryDSQL({ pool, schemaName: currentDomainTestSchema, indexes: indexes as any });
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
  describe('DSQLStore pool integration', () => {
    it('should expose the same pool instance that was passed in', async () => {
      const pool = createTestPool();
      const store = new DSQLStore({ id: 'pool-test', host: TEST_CONFIG.host, pool });
      expect(store.pool).toBe(pool);
      await pool.end();
    });

    it('should not close a passed-in pool when close() is called', async () => {
      const pool = createTestPool();
      const store = new DSQLStore({ id: 'shared-pool-test', host: TEST_CONFIG.host, pool });

      await store.close();

      // Pool should still be usable after store.close()
      const result = await pool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);

      await pool.end();
    });

    it('should close pool when close() is called on internally-created pool', async () => {
      const store = new DSQLStore({
        ...TEST_CONFIG,
        id: 'close-test',
      });

      expect(store.pool).toBeDefined();
      await store.close();

      // Pool should be closed now
      await expect(store.pool.query('SELECT 1')).rejects.toThrow();
    });
  });
} else {
  describe.skip('DSQLStore Integration Tests (skipped: DSQL_HOST not set or DSQL_INTEGRATION !== true)', () => {
    it('placeholder', () => {});
  });
}

// Configuration validation tests (can run without real DSQL connection)
createConfigValidationTests({
  storeName: 'DSQLStore',
  createStore: config => new DSQLStore(config as any),
  validConfigs: [
    {
      description: 'valid basic config',
      config: {
        id: 'test-store',
        host: 'abc123.dsql.us-east-1.on.aws',
        database: 'test',
        user: 'test',
      },
    },
    {
      description: 'config with custom user',
      config: {
        id: 'test-store',
        host: 'abc123.dsql.us-east-1.on.aws',
        user: 'myuser',
      },
    },
    {
      description: 'config with schemaName',
      config: {
        id: 'test-store',
        host: 'abc123.dsql.us-east-1.on.aws',
        database: 'test',
        user: 'test',
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'config with region',
      config: {
        id: 'test-store',
        host: 'abc123.dsql.us-west-2.on.aws',
        region: 'us-west-2',
      },
    },
    {
      description: 'config with disableInit',
      config: {
        id: 'test-store',
        host: 'abc123.dsql.us-east-1.on.aws',
        disableInit: true,
      },
    },
    {
      description: 'config with pool options',
      config: {
        id: 'test-store',
        host: 'abc123.dsql.us-east-1.on.aws',
        max: 20,
        min: 5,
        idleTimeoutMillis: 300000,
        maxLifetimeSeconds: 3000,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty host',
      config: { id: 'test-store', host: '' },
      expectedError: /host must be provided/i,
    },
    {
      description: 'missing host',
      config: { id: 'test-store' },
      expectedError: /host must be provided/i,
    },
    {
      description: 'empty id',
      config: { id: '', host: 'abc123.dsql.us-east-1.on.aws' },
      expectedError: /id must be provided/i,
    },
    {
      description: 'missing id',
      config: { host: 'abc123.dsql.us-east-1.on.aws' },
      expectedError: /id must be provided/i,
    },
  ],
});
