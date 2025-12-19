import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import sql from 'mssql';
import { describe, expect, it, vi } from 'vitest';

import { MemoryMSSQL } from './domains/memory';
import { ScoresMSSQL } from './domains/scores';
import { WorkflowsMSSQL } from './domains/workflows';
import { MSSQLStore } from '.';
import type { MSSQLConfig } from '.';

const TEST_CONFIG: MSSQLConfig = {
  id: process.env.MSSQL_STORE_ID || 'test-mssql-store',
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
};

const CONNECTION_STRING = `Server=${(TEST_CONFIG as any).server},${(TEST_CONFIG as any).port};Database=${(TEST_CONFIG as any).database};User Id=${(TEST_CONFIG as any).user};Password=${(TEST_CONFIG as any).password};Encrypt=true;TrustServerCertificate=true`;

// Helper to create a pre-configured pool for tests
const createTestPool = () =>
  new sql.ConnectionPool({
    server: (TEST_CONFIG as any).server,
    port: (TEST_CONFIG as any).port,
    database: (TEST_CONFIG as any).database,
    user: (TEST_CONFIG as any).user,
    password: (TEST_CONFIG as any).password,
    options: { encrypt: true, trustServerCertificate: true },
  });

// Domain connection config (reusable)
const DOMAIN_CONFIG = {
  server: (TEST_CONFIG as any).server,
  port: (TEST_CONFIG as any).port,
  database: (TEST_CONFIG as any).database,
  user: (TEST_CONFIG as any).user,
  password: (TEST_CONFIG as any).password,
  options: { encrypt: true, trustServerCertificate: true },
};

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

console.log('Not running MSSQL tests in CI. You can enable them if you want to test them locally.');
if (process.env.ENABLE_TESTS === 'true') {
  createTestSuite(new MSSQLStore(TEST_CONFIG));

  // Pre-configured client (pool) acceptance tests
  createClientAcceptanceTests({
    storeName: 'MSSQLStore',
    expectedStoreName: 'MSSQLStore',
    createStoreWithClient: () =>
      new MSSQLStore({
        id: 'mssql-pool-test',
        pool: createTestPool(),
      }),
  });

  // Domain-level pre-configured client tests (using pool directly)
  createDomainDirectTests({
    storeName: 'MSSQL',
    createMemoryDomain: () => new MemoryMSSQL({ pool: createTestPool() }),
    createWorkflowsDomain: () => new WorkflowsMSSQL({ pool: createTestPool() }),
    createScoresDomain: () => new ScoresMSSQL({ pool: createTestPool() }),
  });

  // MSSQL-specific: schemaName option for domains
  describe('MSSQL Domain schemaName Option', () => {
    it('should allow domains to use custom schemaName with connection config', async () => {
      const memoryDomain = new MemoryMSSQL({
        ...DOMAIN_CONFIG,
        schemaName: 'domain_test_schema',
      });

      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      // Test a basic operation to verify it works
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

      // Clean up thread
      await memoryDomain.deleteThread({ threadId: thread.id });
    });

    it('should allow domains to use pool with custom schemaName', async () => {
      const memoryDomain = new MemoryMSSQL({
        pool: createTestPool(),
        schemaName: 'pool_schema_test',
      });

      expect(memoryDomain).toBeDefined();
      await memoryDomain.init();

      // Test a basic operation to verify it works
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

      // Clean up thread
      await memoryDomain.deleteThread({ threadId: thread.id });
    });
  });
} else {
  describe('MSSQLStore', () => {
    it('should be defined', () => {
      expect(MSSQLStore).toBeDefined();
    });
  });
}

// Configuration validation tests (run even without ENABLE_TESTS)
createConfigValidationTests({
  storeName: 'MSSQLStore',
  createStore: config => new MSSQLStore(config as any),
  validConfigs: [
    {
      description: 'valid server/port config',
      config: {
        id: 'test-store',
        server: 'localhost',
        port: 1433,
        database: 'master',
        user: 'sa',
        password: 'password',
      },
    },
    {
      description: 'config with schemaName',
      config: {
        id: 'test-store',
        server: 'localhost',
        port: 1433,
        database: 'master',
        user: 'sa',
        password: 'password',
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'valid connection string',
      config: { id: 'test-store', connectionString: CONNECTION_STRING },
    },
    {
      description: 'pre-configured ConnectionPool',
      config: {
        id: 'test-store',
        pool: new sql.ConnectionPool({
          server: 'localhost',
          database: 'master',
          user: 'sa',
          password: 'password',
        }),
      },
    },
    {
      description: 'pool with schemaName',
      config: {
        id: 'test-store',
        pool: new sql.ConnectionPool({
          server: 'localhost',
          database: 'master',
          user: 'sa',
          password: 'password',
        }),
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'disableInit with server config',
      config: {
        id: 'test-store',
        server: 'localhost',
        port: 1433,
        database: 'master',
        user: 'sa',
        password: 'password',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with pool config',
      config: {
        id: 'test-store',
        pool: new sql.ConnectionPool({
          server: 'localhost',
          database: 'master',
          user: 'sa',
          password: 'password',
        }),
        disableInit: true,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty server',
      config: {
        id: 'test-store',
        server: '',
        port: 1433,
        database: 'master',
        user: 'sa',
        password: 'password',
      },
      expectedError: /server must be provided/i,
    },
    {
      description: 'empty database',
      config: {
        id: 'test-store',
        server: 'localhost',
        port: 1433,
        database: '',
        user: 'sa',
        password: 'password',
      },
      expectedError: /database must be provided/i,
    },
    {
      description: 'empty connectionString',
      config: { id: 'test-store', connectionString: '' },
      expectedError: /connectionString must be provided/i,
    },
  ],
});

// MSSQL-specific: pool exposure test (run even without ENABLE_TESTS)
describe('MSSQLStore Pool Exposure', () => {
  it('should expose pool as public field', () => {
    const pool = new sql.ConnectionPool({
      server: 'localhost',
      database: 'master',
      user: 'sa',
      password: 'password',
    });

    const store = new MSSQLStore({
      id: 'test-store',
      pool,
    });

    expect(store.pool).toBe(pool);
  });
});
