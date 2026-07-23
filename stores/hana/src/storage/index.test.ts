import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createStoreIndexTests,
  createDomainIndexTests,
} from '@internal/storage-test-utils';
import { TABLE_THREADS } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HANAPool } from './db/pool';
import { MemoryHANA } from './domains/memory';
import { ScoresHANA } from './domains/scores';
import { WorkflowsHANA } from './domains/workflows';
import { HANAStore } from '.';
import type { HANAConfig } from '.';

const TEST_CONFIG: HANAConfig = {
  id: process.env.HANA_STORE_ID || 'test-hana-store',
  host: process.env.HANA_HOST || 'localhost',
  port: Number(process.env.HANA_PORT) || 443,
  uid: process.env.HANA_USER || 'MASTRA_USER',
  pwd: process.env.HANA_PASSWORD || 'your-password',
  encrypt: true,
  sslValidateCertificate: true,
};

// Helper to create a pre-configured pool for tests
const createTestPool = () =>
  new HANAPool({
    host: (TEST_CONFIG as any).host,
    port: (TEST_CONFIG as any).port,
    uid: (TEST_CONFIG as any).uid,
    pwd: (TEST_CONFIG as any).pwd,
    encrypt: true,
    sslValidateCertificate: true,
  });

// Domain connection config (reusable)
const DOMAIN_CONFIG = {
  host: (TEST_CONFIG as any).host,
  port: (TEST_CONFIG as any).port,
  uid: (TEST_CONFIG as any).uid,
  pwd: (TEST_CONFIG as any).pwd,
  encrypt: true,
  sslValidateCertificate: true,
};

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

console.log('Not running HANA tests in CI. Set ENABLE_TESTS=true with valid HANA_* env vars to run locally.');
if (process.env.ENABLE_TESTS === 'true') {
  createTestSuite(new HANAStore(TEST_CONFIG), { deterministicScorePagination: true });

  // Pre-configured client (pool) acceptance tests
  createClientAcceptanceTests({
    storeName: 'HANAStore',
    expectedStoreName: 'HANAStore',
    createStoreWithClient: () =>
      new HANAStore({
        id: 'hana-pool-test',
        pool: createTestPool(),
      }),
  });

  // Domain-level pre-configured client tests (using pool directly)
  createDomainDirectTests({
    storeName: 'HANA',
    createMemoryDomain: () => new MemoryHANA({ pool: createTestPool() }),
    createWorkflowsDomain: () => new WorkflowsHANA({ pool: createTestPool() }),
    createScoresDomain: () => new ScoresHANA({ pool: createTestPool() }),
  });

  // HANA-specific: schemaName option for domains
  describe('HANA Domain schemaName Option', () => {
    it('should allow domains to use custom schemaName with connection config', async () => {
      const memoryDomain = new MemoryHANA({
        ...DOMAIN_CONFIG,
        schemaName: 'DOMAIN_TEST_SCHEMA',
      });

      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      const thread = {
        id: `thread-schema-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Schema Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedThread = await memoryDomain.saveThread({ thread });
      expect(savedThread.id).toBe(thread.id);

      await memoryDomain.deleteThread({ threadId: thread.id });
    });

    it('should allow domains to use pool with custom schemaName', async () => {
      const memoryDomain = new MemoryHANA({
        pool: createTestPool(),
        schemaName: 'POOL_SCHEMA_TEST',
      });

      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      const thread = {
        id: `thread-pool-schema-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Pool Schema Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedThread = await memoryDomain.saveThread({ thread });
      expect(savedThread.id).toBe(thread.id);

      await memoryDomain.deleteThread({ threadId: thread.id });
    });
  });
} else {
  describe('HANAStore', () => {
    it('should be defined', () => {
      expect(HANAStore).toBeDefined();
    });
  });
}

// Configuration validation tests (run even without ENABLE_TESTS)
createConfigValidationTests({
  storeName: 'HANAStore',
  createStore: config => new HANAStore(config as any),
  validConfigs: [
    {
      description: 'valid host/port/uid/pwd config',
      config: {
        id: 'test-store',
        host: 'myhost.hanacloud.ondemand.com',
        port: 443,
        uid: 'USER',
        pwd: 'Password1',
      },
    },
    {
      description: 'config with schemaName',
      config: {
        id: 'test-store',
        host: 'myhost.hanacloud.ondemand.com',
        port: 443,
        uid: 'USER',
        pwd: 'Password1',
        schemaName: 'CUSTOM_SCHEMA',
      },
    },
    {
      description: 'pre-configured HANAPool',
      config: {
        id: 'test-store',
        pool: new HANAPool({
          host: 'myhost.hanacloud.ondemand.com',
          port: 443,
          uid: 'USER',
          pwd: 'Password1',
        }),
      },
    },
    {
      description: 'pool with schemaName',
      config: {
        id: 'test-store',
        pool: new HANAPool({
          host: 'myhost.hanacloud.ondemand.com',
          port: 443,
          uid: 'USER',
          pwd: 'Password1',
        }),
        schemaName: 'CUSTOM_SCHEMA',
      },
    },
    {
      description: 'disableInit with host config',
      config: {
        id: 'test-store',
        host: 'myhost.hanacloud.ondemand.com',
        port: 443,
        uid: 'USER',
        pwd: 'Password1',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with pool config',
      config: {
        id: 'test-store',
        pool: new HANAPool({
          host: 'myhost.hanacloud.ondemand.com',
          port: 443,
          uid: 'USER',
          pwd: 'Password1',
        }),
        disableInit: true,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty host',
      config: {
        id: 'test-store',
        host: '',
        port: 443,
        uid: 'USER',
        pwd: 'Password1',
      },
      expectedError: /host must be provided/i,
    },
    {
      description: 'empty uid',
      config: {
        id: 'test-store',
        host: 'myhost.hanacloud.ondemand.com',
        port: 443,
        uid: '',
        pwd: 'Password1',
      },
      expectedError: /uid must be provided/i,
    },
  ],
});

// HANA-specific: pool exposure test (run even without ENABLE_TESTS)
describe('HANAStore Pool Exposure', () => {
  it('should expose pool as public field', () => {
    const pool = new HANAPool({
      host: 'myhost.hanacloud.ondemand.com',
      port: 443,
      uid: 'USER',
      pwd: 'Password1',
    });

    const store = new HANAStore({
      id: 'test-store',
      pool,
    });

    expect(store.pool).toBe(pool);
  });
});

describe('HANAStore SQL injection prevention', () => {
  it('should reject a schemaName containing SQL metacharacters', () => {
    expect(
      () =>
        new HANAStore({
          id: 'test-store',
          host: 'myhost.hanacloud.ondemand.com',
          port: 443,
          uid: 'USER',
          pwd: 'Password1',
          schemaName: 'VALID_SCHEMA"; DROP TABLE mastra_threads; --',
        }),
    ).toThrow(/Invalid schema name/i);
  });

  it('should reject a schemaName containing a double-quote character', () => {
    expect(
      () =>
        new HANAStore({
          id: 'test-store',
          host: 'myhost.hanacloud.ondemand.com',
          port: 443,
          uid: 'USER',
          pwd: 'Password1',
          schemaName: 'SCHEMA"INJECTED',
        }),
    ).toThrow(/Invalid schema name/i);
  });

  it('should accept a valid schemaName', () => {
    expect(
      () =>
        new HANAStore({
          id: 'test-store',
          host: 'myhost.hanacloud.ondemand.com',
          port: 443,
          uid: 'USER',
          pwd: 'Password1',
          schemaName: 'MASTRA_APP',
        }),
    ).not.toThrow();
  });
});

if (process.env.ENABLE_TESTS === 'true') {
  // Helper to check if a HANA index exists (case-insensitive name match)
  const hanaIndexExists = async (store: HANAStore, namePattern: string): Promise<boolean> => {
    const schemaName = ((store as any).schema || '').toUpperCase();
    try {
      const rows = (await store.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM SYS.INDEXES WHERE SCHEMA_NAME = ? AND UPPER(INDEX_NAME) LIKE ?`, [
          schemaName,
          `%${namePattern.toUpperCase()}%`,
        ]),
      )) as Array<{ CNT: number }>;
      return Number(rows[0]?.CNT ?? 0) > 0;
    } catch {
      return false;
    }
  };

  // Drop indexes by column-list pattern (handles HANA storing names in original case)
  const dropIndexesByPattern = async (patterns: string[]): Promise<void> => {
    const pool = createTestPool();
    try {
      await pool.initialize();
      for (const pattern of patterns) {
        const rows = (await pool.withConnection(conn =>
          conn.execPromise(
            `SELECT INDEX_NAME FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER AND UPPER(INDEX_NAME) LIKE ?`,
            [`%${pattern.toUpperCase()}%`],
          ),
        )) as Array<{ INDEX_NAME: string }>;
        for (const row of rows) {
          try {
            await pool.withConnection(conn => conn.execPromise(`DROP INDEX "${row.INDEX_NAME}"`, []));
          } catch {
            // Ignore drop errors
          }
        }
      }
    } catch {
      // Ignore pool errors during cleanup
    } finally {
      await pool.destroy();
    }
  };

  describe('HANAStore and MemoryHANA Index Configuration (with cleanup)', () => {
    afterEach(async () => {
      // Drop all test indexes after each index-config test so subsequent tests start clean.
      await dropIndexesByPattern([
        'threads_resourceid',
        'messages_thread_id',
        'custom_hana_test_idx',
        'custom_memory_hana_idx',
      ]);
    });

    const storeTestId = Math.floor(Date.now() / 1000) % 100000;
    createStoreIndexTests({
      storeName: 'HANAStore',
      createDefaultStore: () =>
        new HANAStore({
          ...TEST_CONFIG,
          id: 'hana-idx-default',
          schemaName: `IDX_S_${storeTestId}_D`,
        }),
      createStoreWithSkipDefaults: () =>
        new HANAStore({
          ...TEST_CONFIG,
          id: 'hana-idx-skip',
          schemaName: `IDX_S_${storeTestId}_S`,
          skipDefaultIndexes: true,
        }),
      createStoreWithCustomIndexes: indexes =>
        new HANAStore({
          ...TEST_CONFIG,
          id: 'hana-idx-custom',
          schemaName: `IDX_S_${storeTestId}_C`,
          indexes: indexes.map(idx => ({
            name: idx.name,
            table: (idx as any).table || TABLE_THREADS,
            columns: (idx as any).columns || ['title'],
          })),
        }),
      createStoreWithInvalidTable: indexes =>
        new HANAStore({
          ...TEST_CONFIG,
          id: 'hana-idx-invalid',
          schemaName: `IDX_S_${storeTestId}_I`,
          indexes: indexes.map(idx => ({
            name: idx.name,
            table: (idx as any).table || 'nonexistent_table_xyz',
            columns: (idx as any).columns || ['id'],
          })),
        }),
      indexExists: (store, pattern) => hanaIndexExists(store as HANAStore, pattern),
      defaultIndexPattern: 'threads_resourceid',
      customIndexName: 'custom_hana_test_idx',
      customIndexDef: {
        name: 'custom_hana_test_idx',
        table: TABLE_THREADS,
        columns: ['title'],
      },
      invalidTableIndexDef: {
        name: 'invalid_table_idx',
        table: 'nonexistent_table_xyz',
        columns: ['id'],
      },
    });

    const domainTestId = (Math.floor(Date.now() / 1000) % 100000) + 1;

    createDomainIndexTests({
      domainName: 'MemoryHANA',
      createDefaultDomain: () => new MemoryHANA({ ...DOMAIN_CONFIG, schemaName: `IDX_D_${domainTestId}_D` }),
      createDomainWithSkipDefaults: () =>
        new MemoryHANA({ ...DOMAIN_CONFIG, schemaName: `IDX_D_${domainTestId}_S`, skipDefaultIndexes: true }),
      createDomainWithCustomIndexes: indexes =>
        new MemoryHANA({
          ...DOMAIN_CONFIG,
          schemaName: `IDX_D_${domainTestId}_C`,
          indexes: indexes.map(idx => ({
            name: idx.name,
            table: (idx as any).table || TABLE_THREADS,
            columns: (idx as any).columns || ['updatedAt'],
          })),
        }),
      createDomainWithInvalidTable: indexes =>
        new MemoryHANA({
          ...DOMAIN_CONFIG,
          schemaName: `IDX_D_${domainTestId}_I`,
          indexes: indexes.map(idx => ({
            name: idx.name,
            table: (idx as any).table || 'nonexistent_table_xyz',
            columns: (idx as any).columns || ['id'],
          })),
        }),
      indexExists: async (_domain, pattern) => {
        const pool = createTestPool();
        try {
          await pool.initialize();
          // Use CURRENT_USER and case-insensitive match since HANA stores index names in original case.
          const rows = (await pool.withConnection(conn =>
            conn.execPromise(
              `SELECT COUNT(*) AS CNT FROM SYS.INDEXES WHERE SCHEMA_NAME = CURRENT_USER AND UPPER(INDEX_NAME) LIKE ?`,
              [`%${pattern.toUpperCase()}%`],
            ),
          )) as Array<{ CNT: number }>;
          return Number(rows[0]?.CNT ?? 0) > 0;
        } finally {
          await pool.destroy();
        }
      },
      defaultIndexPattern: 'threads_resourceid',
      customIndexName: 'custom_memory_hana_idx',
      customIndexDef: {
        name: 'custom_memory_hana_idx',
        table: TABLE_THREADS,
        // Use a different column from the store-level custom index ('title') to avoid
        // HANA error 261 "column list already indexed" when both run in CURRENT_USER schema.
        columns: ['updatedAt'],
      },
      invalidTableIndexDef: {
        name: 'invalid_domain_table_idx',
        table: 'nonexistent_table_xyz',
        columns: ['id'],
      },
    });
  });
}
