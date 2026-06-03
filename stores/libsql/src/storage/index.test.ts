import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import { DatasetsLibSQL } from './domains/datasets';
import { ExperimentsLibSQL } from './domains/experiments';
import { MemoryLibSQL } from './domains/memory';
import { ScoresLibSQL } from './domains/scores';
import { WorkflowsLibSQL } from './domains/workflows';
import { LibSQLStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_DB_URL = 'file::memory:?cache=shared';

// Helper to create a fresh client for each test
const createTestClient = () => createClient({ url: TEST_DB_URL });

// Main storage test suite
const libsql = new LibSQLStore({
  id: 'libsql-test-store',
  url: TEST_DB_URL,
});

const mastra = new Mastra({
  storage: libsql,
});

createTestSuite(mastra.getStorage()!);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'LibSQLStore',
  createStore: config => new LibSQLStore(config as any),
  validConfigs: [
    { description: 'URL config', config: { id: 'test-store', url: TEST_DB_URL } },
    {
      description: 'URL config with authToken',
      config: { id: 'test-store', url: 'libsql://my-db.turso.io', authToken: 'test-token' },
    },
    {
      description: 'URL config with retry options',
      config: { id: 'test-store', url: TEST_DB_URL, maxRetries: 10, initialBackoffMs: 200 },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'client with retry options',
      config: { id: 'test-store', client: createTestClient(), maxRetries: 10, initialBackoffMs: 200 },
    },
    { description: 'disableInit with URL config', config: { id: 'test-store', url: TEST_DB_URL, disableInit: true } },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    { description: 'empty id', config: { id: '', url: TEST_DB_URL }, expectedError: /id must be provided/i },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'LibSQLStore',
  expectedStoreName: 'LibSQLStore',
  createStoreWithClient: () =>
    new LibSQLStore({
      id: 'libsql-client-test',
      client: createTestClient(),
    }),
  createStoreWithClientAndOptions: () =>
    new LibSQLStore({
      id: 'libsql-client-options-test',
      client: createTestClient(),
      maxRetries: 10,
      initialBackoffMs: 200,
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'LibSQL',
  createMemoryDomain: () => new MemoryLibSQL({ client: createTestClient() }),
  createWorkflowsDomain: () => new WorkflowsLibSQL({ client: createTestClient() }),
  createScoresDomain: () => new ScoresLibSQL({ client: createTestClient() }),
  createDatasetsDomain: () => new DatasetsLibSQL({ client: createTestClient() }),
  createExperimentsDomain: () => new ExperimentsLibSQL({ client: createTestClient() }),
  createMemoryDomainWithOptions: () =>
    new MemoryLibSQL({
      client: createTestClient(),
      maxRetries: 10,
      initialBackoffMs: 200,
    }),
});

describe('LibSQLStore notifications domain', () => {
  it('exposes notifications through the composite store', async () => {
    const client = createTestClient();
    try {
      const store = new LibSQLStore({ id: 'libsql-notifications-test', client, maxRetries: 1, initialBackoffMs: 10 });
      await store.init();

      const notifications = await store.getStore('notifications');
      expect(notifications).toBeDefined();

      const record = await notifications!.createNotification({
        id: 'notification-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        agentId: 'agent-1',
        source: 'mastracode',
        kind: 'manual',
        summary: 'Composite notification',
      });

      expect(record.id).toBe('notification-1');
      await expect(
        notifications!.getNotification({ threadId: 'thread-1', id: 'notification-1' }),
      ).resolves.toMatchObject({
        summary: 'Composite notification',
      });
    } finally {
      client.close();
    }
  });
});
