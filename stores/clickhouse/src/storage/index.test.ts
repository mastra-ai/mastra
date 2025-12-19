import { createClient } from '@clickhouse/client';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import { describe, expect, it, vi } from 'vitest';

import { MemoryStorageClickhouse } from './domains/memory';
import { ScoresStorageClickhouse } from './domains/scores';
import { WorkflowsStorageClickhouse } from './domains/workflows';
import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: ClickhouseConfig = {
  id: 'clickhouse-test',
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
};

// Helper to create a fresh client for each test
const createTestClient = () =>
  createClient({
    url: TEST_CONFIG.url,
    username: TEST_CONFIG.username,
    password: TEST_CONFIG.password,
  });

const storage = new ClickhouseStore(TEST_CONFIG);

createTestSuite(storage);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'ClickhouseStore',
  createStore: config => new ClickhouseStore(config as any),
  validConfigs: [
    {
      description: 'URL/credentials config',
      config: { id: 'test-store', url: 'http://localhost:8123', username: 'default', password: 'password' },
    },
    {
      description: 'empty string for username and password (default user)',
      config: { id: 'test-store', url: 'http://localhost:8123', username: '', password: '' },
    },
    {
      description: 'config with TTL options',
      config: {
        id: 'test-store',
        url: 'http://localhost:8123',
        username: 'default',
        password: 'password',
        ttl: { mastra_traces: { row: { interval: 600, unit: 'SECOND' } } },
      },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'client with TTL options',
      config: {
        id: 'test-store',
        client: createTestClient(),
        ttl: { mastra_traces: { row: { interval: 600, unit: 'SECOND' } } },
      },
    },
    {
      description: 'disableInit with URL config',
      config: {
        id: 'test-store',
        url: 'http://localhost:8123',
        username: 'default',
        password: 'password',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '', username: 'default', password: 'password' },
      expectedError: /url is required/i,
    },
    {
      description: 'username not a string',
      config: { id: 'test-store', url: 'http://localhost:8123', username: undefined, password: 'password' },
      expectedError: /username must be a string/i,
    },
    {
      description: 'password not a string',
      config: { id: 'test-store', url: 'http://localhost:8123', username: 'default', password: undefined },
      expectedError: /password must be a string/i,
    },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'ClickhouseStore',
  expectedStoreName: 'ClickhouseStore',
  createStoreWithClient: () =>
    new ClickhouseStore({
      id: 'clickhouse-client-test',
      client: createTestClient(),
    }),
  createStoreWithClientAndOptions: () =>
    new ClickhouseStore({
      id: 'clickhouse-client-opts-test',
      client: createTestClient(),
      ttl: { mastra_traces: { row: { interval: 600, unit: 'SECOND' } } },
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'ClickHouse',
  createMemoryDomain: () => new MemoryStorageClickhouse({ client: createTestClient() }),
  createWorkflowsDomain: () => new WorkflowsStorageClickhouse({ client: createTestClient() }),
  createScoresDomain: () => new ScoresStorageClickhouse({ client: createTestClient() }),
  createMemoryDomainWithOptions: () =>
    new MemoryStorageClickhouse({
      client: createTestClient(),
      ttl: { mastra_threads: { row: { interval: 30, unit: 'DAY' } } },
    }),
});

// Additional ClickHouse-specific tests
describe('ClickHouse Domain with URL/credentials config', () => {
  it('should allow domains to accept URL/credentials config directly', async () => {
    const memoryDomain = new MemoryStorageClickhouse({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username || 'default',
      password: TEST_CONFIG.password || '',
    });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    const thread = {
      id: `thread-url-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test URL Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    await memoryDomain.deleteThread({ threadId: thread.id });
  });
});
