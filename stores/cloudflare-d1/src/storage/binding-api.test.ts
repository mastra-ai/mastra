import type { D1Database } from '@cloudflare/workers-types';
import {
  createTestSuite,
  createClientAcceptanceTests,
  createDomainDirectTests,
  createConfigValidationTests,
} from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { vi } from 'vitest';

import { MemoryStorageD1 } from './domains/memory';
import { ScoresStorageD1 } from './domains/scores';
import { WorkflowsStorageD1 } from './domains/workflows';
import { D1Store } from '.';
import type { D1Client } from '.';

dotenv.config();

// Increase timeout for all tests in this file
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// Create a Miniflare instance with D1
const mf = new Miniflare({
  modules: true,
  script: 'export default {};',
  d1Databases: { TEST_DB: ':memory:' }, // Use in-memory SQLite for tests
});

// Get the D1 database from Miniflare (async at top level)
const d1Database = await mf.getD1Database('TEST_DB');

// Create a D1Client from the Miniflare binding for factory tests
const createD1Client = (binding: D1Database): D1Client => ({
  query: async ({ sql, params }) => {
    const stmt = binding.prepare(sql);
    const result = await stmt.bind(...params).all();
    return { result: [result] as any };
  },
});

const testClient = createD1Client(d1Database);

createTestSuite(
  new D1Store({
    id: 'd1-test-store',
    binding: d1Database,
    tablePrefix: 'test_',
  }),
);

// Pre-configured client acceptance tests (using binding)
createClientAcceptanceTests({
  storeName: 'D1Store (binding)',
  expectedStoreName: 'D1',
  createStoreWithClient: () =>
    new D1Store({
      id: 'd1-binding-test',
      binding: d1Database,
      tablePrefix: `test_binding_${Date.now()}_`,
    }),
  createStoreWithClientAndOptions: () =>
    new D1Store({
      id: 'd1-binding-opts-test',
      binding: d1Database,
      tablePrefix: 'test_prefix_',
    }),
});

// Pre-configured client acceptance tests (using D1Client)
createClientAcceptanceTests({
  storeName: 'D1Store (client)',
  expectedStoreName: 'D1',
  createStoreWithClient: () =>
    new D1Store({
      id: 'd1-client-test',
      client: testClient,
      tablePrefix: `client_test_${Date.now()}_`,
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'D1',
  createMemoryDomain: () =>
    new MemoryStorageD1({
      binding: d1Database,
      tablePrefix: `test_memory_domain_${Date.now()}_`,
    }),
  createWorkflowsDomain: () =>
    new WorkflowsStorageD1({
      binding: d1Database,
      tablePrefix: `test_workflows_domain_${Date.now()}_`,
    }),
  createScoresDomain: () =>
    new ScoresStorageD1({
      binding: d1Database,
      tablePrefix: `test_scores_domain_${Date.now()}_`,
    }),
});

// Configuration validation tests
createConfigValidationTests({
  storeName: 'D1Store',
  createStore: config => new D1Store(config as any),
  usesMastraError: true,
  validConfigs: [
    { description: 'binding config', config: { id: 'test-store', binding: d1Database } },
    {
      description: 'binding with tablePrefix',
      config: { id: 'test-store', binding: d1Database, tablePrefix: 'custom_prefix_' },
    },
    { description: 'D1Client', config: { id: 'test-store', client: testClient } },
    {
      description: 'REST API config',
      config: { id: 'test-store', accountId: 'test-account', apiToken: 'test-token', databaseId: 'test-db' },
    },
    { description: 'disableInit with binding', config: { id: 'test-store', binding: d1Database, disableInit: true } },
    { description: 'disableInit with client', config: { id: 'test-store', client: testClient, disableInit: true } },
    {
      description: 'tablePrefix with letters, numbers, underscores',
      config: { id: 'test-store', binding: d1Database, tablePrefix: 'valid_prefix_123' },
    },
  ],
  invalidConfigs: [
    {
      description: 'falsy binding',
      config: { id: 'test-store', binding: null },
      expectedError: /D1 binding is required/,
    },
    { description: 'falsy client', config: { id: 'test-store', client: null }, expectedError: /D1 client is required/ },
    {
      description: 'missing accountId in REST API config',
      config: { id: 'test-store', accountId: '', apiToken: 'test-token', databaseId: 'test-db' },
      expectedError: /accountId, databaseId, and apiToken are required/,
    },
    {
      description: 'missing apiToken in REST API config',
      config: { id: 'test-store', accountId: 'test-account', apiToken: '', databaseId: 'test-db' },
      expectedError: /accountId, databaseId, and apiToken are required/,
    },
    {
      description: 'missing databaseId in REST API config',
      config: { id: 'test-store', accountId: 'test-account', apiToken: 'test-token', databaseId: '' },
      expectedError: /accountId, databaseId, and apiToken are required/,
    },
    {
      description: 'tablePrefix with invalid special characters',
      config: { id: 'test-store', binding: d1Database, tablePrefix: 'invalid-prefix!' },
      expectedError: /Invalid tablePrefix/,
    },
  ],
});
