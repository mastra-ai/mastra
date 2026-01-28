import { randomUUID } from 'node:crypto';
import { createTestSuite, createConfigValidationTests } from '@internal/storage-test-utils';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { StoreMemoryRedis } from './domains/memory';
import { ScoresRedis } from './domains/scores';
import { WorkflowsRedis } from './domains/workflows';
import type { RedisConfig, RedisClient } from './index';
import { RedisStore } from './index';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const TEST_CONFIG = {
  host: 'localhost',
  port: 6380,
  password: 'redis_password',
};

const getConnectionUrl = () => `redis://:${TEST_CONFIG.password}@${TEST_CONFIG.host}:${TEST_CONFIG.port}`;

const createTestClient = async (): Promise<RedisClient> => {
  const client = createClient({ url: getConnectionUrl() });
  await client.connect();
  return client as unknown as RedisClient;
};

const createThread = (overrides: Partial<StorageThreadType> = {}): StorageThreadType => ({
  id: `thread-${randomUUID()}`,
  resourceId: `resource-${randomUUID()}`,
  title: 'Test Thread',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMessage = (params: {
  threadId: string;
  resourceId: string;
  createdAt: Date;
  content: string;
}): MastraDBMessage => ({
  id: randomUUID(),
  threadId: params.threadId,
  resourceId: params.resourceId,
  role: 'user',
  createdAt: params.createdAt,
  content: {
    format: 2,
    parts: [{ type: 'text', text: params.content }],
    content: params.content,
  },
});

createTestSuite(
  new RedisStore({
    id: 'redis-test-store',
    ...TEST_CONFIG,
  }),
);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'RedisStore',
  createStore: config => new RedisStore(config as RedisConfig),
  validConfigs: [
    {
      description: 'host/port config',
      config: { id: 'test-store', host: 'localhost', port: 6379, password: 'redis_password' },
    },
    {
      description: 'connection string config',
      config: { id: 'test-store', connectionString: 'redis://:redis_password@localhost:6379' },
    },
    {
      description: 'disableInit with host config',
      config: { id: 'test-store', host: 'localhost', port: 6379, password: 'redis_password', disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty host',
      config: { id: 'test-store', host: '', port: 6379 },
      expectedError: /host is required/i,
    },
    {
      description: 'empty connection string',
      config: { id: 'test-store', connectionString: '' },
      expectedError: /connectionString is required/i,
    },
  ],
});

// Pre-configured client acceptance tests
describe('RedisStore client acceptance tests', () => {
  it('should accept a pre-configured client', async () => {
    const client = await createTestClient();
    const store = new RedisStore({
      id: 'redis-client-test',
      client,
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('Redis');

    await client.quit();
  });
});

// Domain-level pre-configured client tests
describe('Redis domain direct tests', () => {
  it('should allow memory domain with pre-configured client', async () => {
    const client = await createTestClient();
    const memoryDomain = new StoreMemoryRedis({ client });
    expect(memoryDomain).toBeDefined();
    await client.quit();
  });

  it('should allow workflows domain with pre-configured client', async () => {
    const client = await createTestClient();
    const workflowsDomain = new WorkflowsRedis({ client });
    expect(workflowsDomain).toBeDefined();
    await client.quit();
  });

  it('should allow scores domain with pre-configured client', async () => {
    const client = await createTestClient();
    const scoresDomain = new ScoresRedis({ client });
    expect(scoresDomain).toBeDefined();
    await client.quit();
  });
});

// Additional Redis-specific tests
describe('Redis Domain with client config', () => {
  it('should allow domains to use client config directly', async () => {
    const client = await createTestClient();
    const memoryDomain = new StoreMemoryRedis({ client });

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
    await client.quit();
  });
});

describe('RedisStore connection options', () => {
  it('should connect using connection string', async () => {
    const storage = new RedisStore({
      id: 'connstring-test',
      connectionString: getConnectionUrl(),
    });

    await storage.init();
    const memory = await storage.getStore('memory');
    expect(memory).toBeDefined();
    await storage.close();
  });

  it('should connect using host/port config', async () => {
    const storage = new RedisStore({
      id: 'hostport-test',
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      password: TEST_CONFIG.password,
    });

    await storage.init();
    const memory = await storage.getStore('memory');
    expect(memory).toBeDefined();
    await storage.close();
  });

  it('should expose the underlying client via getClient()', async () => {
    const storage = new RedisStore({
      id: 'getclient-test',
      ...TEST_CONFIG,
    });

    await storage.init();
    const client = storage.getClient();
    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.set).toBe('function');
    await storage.close();
  });
});

describe('Redis ordering regression tests', () => {
  let storage: RedisStore;
  let memory: MemoryStorage;

  beforeAll(async () => {
    storage = new RedisStore({
      id: `redis-ordering-test-${Date.now()}`,
      ...TEST_CONFIG,
    });
    await storage.init();
    const store = await storage.getStore('memory');
    if (!store) {
      throw new Error('Memory storage not found');
    }
    memory = store;
  });

  afterAll(async () => {
    await storage.close();
  });

  it('should include chronological next messages across multiple save batches', async () => {
    const thread = createThread();
    await memory.saveThread({ thread });

    const baseTime = Date.now();
    const batch1 = [
      createMessage({
        threadId: thread.id,
        resourceId: thread.resourceId,
        createdAt: new Date(baseTime + 1000),
        content: 'A',
      }),
      createMessage({
        threadId: thread.id,
        resourceId: thread.resourceId,
        createdAt: new Date(baseTime + 2000),
        content: 'B',
      }),
      createMessage({
        threadId: thread.id,
        resourceId: thread.resourceId,
        createdAt: new Date(baseTime + 3000),
        content: 'C',
      }),
    ];
    await memory.saveMessages({ messages: batch1 });

    const batch2 = [
      createMessage({
        threadId: thread.id,
        resourceId: thread.resourceId,
        createdAt: new Date(baseTime + 4000),
        content: 'D',
      }),
      createMessage({
        threadId: thread.id,
        resourceId: thread.resourceId,
        createdAt: new Date(baseTime + 5000),
        content: 'E',
      }),
    ];
    await memory.saveMessages({ messages: batch2 });

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 1,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      include: [
        {
          id: batch1[1]!.id,
          withNextMessages: 2,
        },
      ],
    });

    const contents = result.messages.map(message => message.content.content);
    expect(contents).toEqual(['A', 'B', 'C', 'D']);
  });

  it('should preserve chronological order when moving a message between threads', async () => {
    const thread1 = createThread();
    const thread2 = createThread();
    await memory.saveThread({ thread: thread1 });
    await memory.saveThread({ thread: thread2 });

    const baseTime = Date.now();
    const thread2Messages = [
      createMessage({
        threadId: thread2.id,
        resourceId: thread2.resourceId,
        createdAt: new Date(baseTime + 2000),
        content: 'Two',
      }),
      createMessage({
        threadId: thread2.id,
        resourceId: thread2.resourceId,
        createdAt: new Date(baseTime + 4000),
        content: 'Four',
      }),
    ];
    await memory.saveMessages({ messages: thread2Messages });

    const movingMessage = createMessage({
      threadId: thread1.id,
      resourceId: thread1.resourceId,
      createdAt: new Date(baseTime + 3000),
      content: 'Three',
    });
    await memory.saveMessages({ messages: [movingMessage] });

    await memory.updateMessages({
      messages: [{ id: movingMessage.id, threadId: thread2.id }],
    });

    const result = await memory.listMessages({
      threadId: thread2.id,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    const contents = result.messages.map(message => message.content.content);
    expect(contents).toEqual(['Two', 'Three', 'Four']);
  });
});
