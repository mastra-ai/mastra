import { Client as ElasticSearchClient } from '@elastic/elasticsearch';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MemoryElasticSearch } from './domains/memory';
import { ScoresElasticSearch } from './domains/scores';
import { WorkflowsElasticSearch } from './domains/workflows';
import { ElasticSearchStore } from './store';
import type { ElasticSearchConfig } from './types';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const url = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

createTestSuite(
  new ElasticSearchStore({
    id: 'elasticsearch-test-store',
    url,
  }),
);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'ElasticSearchStore',
  createStore: config => new ElasticSearchStore(config as ElasticSearchConfig),
  validConfigs: [
    {
      description: 'url config',
      config: { id: 'test-store', url },
    },
    {
      description: 'disableInit with url config',
      config: { id: 'test-store', url, disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '' },
      expectedError: /client.*or.*url/i,
    },
    {
      description: 'missing url and client',
      config: { id: 'test-store' },
      expectedError: /client.*or.*url/i,
    },
  ],
});

// Pre-configured client acceptance + domain direct tests
let sharedClient: ElasticSearchClient;

beforeAll(() => {
  sharedClient = new ElasticSearchClient({ node: url });
});

afterAll(async () => {
  await sharedClient.close();
});

createClientAcceptanceTests({
  storeName: 'ElasticSearchStore',
  expectedStoreName: 'ElasticSearch',
  createStoreWithClient: () =>
    new ElasticSearchStore({
      id: 'elasticsearch-client-test',
      client: sharedClient,
    }),
});

createDomainDirectTests({
  storeName: 'ElasticSearch',
  createMemoryDomain: () => new MemoryElasticSearch({ client: sharedClient }),
  createWorkflowsDomain: () => new WorkflowsElasticSearch({ client: sharedClient }),
  createScoresDomain: () => new ScoresElasticSearch({ client: sharedClient }),
});

describe('ElasticSearchStore connection options', () => {
  it('should connect using a url', async () => {
    const storage = new ElasticSearchStore({ id: 'url-test', url });

    await storage.init();
    const memory = await storage.getStore('memory');
    expect(memory).toBeDefined();
    await storage.close();
  });

  it('should expose the underlying client via getClient()', async () => {
    const storage = new ElasticSearchStore({ id: 'getclient-test', url });

    await storage.init();
    const client = storage.getClient();
    expect(client).toBeDefined();
    expect(typeof client.index).toBe('function');
    expect(typeof client.search).toBe('function');
    await storage.close();
  });

  it('should not close a user-provided client', async () => {
    const client = new ElasticSearchClient({ node: url });
    const storage = new ElasticSearchStore({ id: 'external-client-test', client });

    await storage.init();
    await storage.close();

    // Client is still usable after storage.close()
    const info = await client.info();
    expect(info.cluster_name).toBeDefined();
    await client.close();
  });
});

describe('ElasticSearch domain with client config', () => {
  it('should allow domains to use client config directly', async () => {
    const client = new ElasticSearchClient({ node: url });
    const memoryDomain = new MemoryElasticSearch({ client });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    const thread = {
      id: `thread-client-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Client Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    await memoryDomain.deleteThread({ threadId: thread.id });
    await client.close();
  });
});
