import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import pgPromise from 'pg-promise';
import { vi } from 'vitest';

import { MemoryPG } from './domains/memory';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';
import { pgTests, TEST_CONFIG, connectionString } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createTestSuite(new PostgresStore(TEST_CONFIG));
createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: 'my_schema' }));

// Helper to create a pre-configured pg-promise client
const createTestClient = () => {
  const pgp = pgPromise();
  return { client: pgp(connectionString), pgp };
};

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'PostgresStore',
  expectedStoreName: 'PostgresStore',
  createStoreWithClient: () => {
    const { client } = createTestClient();
    return new PostgresStore({
      id: 'pg-client-test',
      client,
    });
  },
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'PostgreSQL',
  createMemoryDomain: () => {
    const { client } = createTestClient();
    return new MemoryPG({ client });
  },
  createWorkflowsDomain: () => {
    const { client } = createTestClient();
    return new WorkflowsPG({ client });
  },
  createScoresDomain: () => {
    const { client } = createTestClient();
    return new ScoresPG({ client });
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
      description: 'pre-configured pg-promise client',
      config: { id: 'test-store', client: createTestClient().client },
    },
    {
      description: 'client with schemaName',
      config: { id: 'test-store', client: createTestClient().client, schemaName: 'custom_schema' },
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
      description: 'disableInit with client',
      config: { id: 'test-store', client: createTestClient().client, disableInit: true },
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
      expectedError: /connectionString must be a non-empty string/i,
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
      expectedError: /invalid config.*Provide either.*connectionString.*host.*ClientConfig/i,
    },
    {
      description: 'completely empty config',
      config: { id: 'test-store' },
      expectedError: /invalid config.*Provide either.*connectionString.*host.*ClientConfig/i,
    },
  ],
});

// PG-specific tests (public fields, table quoting, permissions, function namespace, timestamp fallback, Cloud SQL, etc.)
pgTests();
