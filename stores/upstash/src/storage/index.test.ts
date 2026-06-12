import { randomUUID } from 'node:crypto';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { TABLE_MESSAGES } from '@mastra/core/storage';
import { Redis } from '@upstash/redis';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreMemoryUpstash } from './domains/memory';
import { ScoresUpstash } from './domains/scores';
import { getKey } from './domains/utils';
import { WorkflowsUpstash } from './domains/workflows';
import { UpstashStore } from './index';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const TEST_CONFIG = {
  url: 'http://localhost:8079',
  token: 'test_token',
};

// Helper to create a fresh client for each test
const createTestClient = () =>
  new Redis({
    url: TEST_CONFIG.url,
    token: TEST_CONFIG.token,
  });

const createThread = (resourceId = `resource-${randomUUID()}`): StorageThreadType => ({
  id: `thread-${randomUUID()}`,
  resourceId,
  title: 'Test Thread',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createMessage = (thread: StorageThreadType, overrides: Partial<MastraDBMessage> = {}): MastraDBMessage => ({
  id: overrides.id ?? randomUUID(),
  threadId: overrides.threadId ?? thread.id,
  resourceId: overrides.resourceId ?? thread.resourceId,
  role: overrides.role ?? 'user',
  createdAt: overrides.createdAt ?? new Date(),
  content: overrides.content ?? {
    format: 2,
    parts: [{ type: 'text', text: 'Test message' }],
    content: 'Test message',
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

createTestSuite(
  new UpstashStore({
    id: 'upstash-test-store',
    ...TEST_CONFIG,
  }),
);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'UpstashStore',
  createStore: config => new UpstashStore(config as any),
  validConfigs: [
    {
      description: 'URL/token config',
      config: { id: 'test-store', url: 'http://localhost:8079', token: 'test-token' },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'disableInit with URL config',
      config: { id: 'test-store', url: 'http://localhost:8079', token: 'test-token', disableInit: true },
    },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '', token: 'test-token' },
      expectedError: /url is required/i,
    },
    {
      description: 'empty token',
      config: { id: 'test-store', url: 'http://localhost:8079', token: '' },
      expectedError: /token is required/i,
    },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'UpstashStore',
  expectedStoreName: 'Upstash',
  createStoreWithClient: () =>
    new UpstashStore({
      id: 'upstash-client-test',
      client: createTestClient(),
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'Upstash',
  createMemoryDomain: () => new StoreMemoryUpstash({ client: createTestClient() }),
  createWorkflowsDomain: () => new WorkflowsUpstash({ client: createTestClient() }),
  createScoresDomain: () => new ScoresUpstash({ client: createTestClient() }),
});

// Additional Upstash-specific tests
describe('Upstash Domain with URL/token config', () => {
  it('should allow domains to use url/token config directly', async () => {
    const memoryDomain = new StoreMemoryUpstash({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
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

describe('saveMessages uses msg-idx index instead of scanning', () => {
  it('uses index lookup instead of scan when moving a message between threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    // Save message to source thread (creates msg-idx entry)
    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    await new Promise(resolve => setTimeout(resolve, 10));

    const client = (memoryDomain as any).client as Redis;
    const scanSpy = vi.spyOn(client, 'scan');

    // Move same message ID to target thread
    const movedMessage = createMessage(targetThread, {
      id: originalMessage.id,
      resourceId: targetThread.resourceId,
    });
    await memoryDomain.saveMessages({ messages: [movedMessage] });

    // Should not scan — used msg-idx index
    expect(scanSpy).not.toHaveBeenCalled();

    // Message should be removed from source and exist in target
    const { messages: sourceMessages } = await memoryDomain.listMessages({ threadId: sourceThread.id });
    const { messages: targetMessages } = await memoryDomain.listMessages({ threadId: targetThread.id });
    expect(sourceMessages.find(m => m.id === originalMessage.id)).toBeUndefined();
    expect(targetMessages.find(m => m.id === originalMessage.id)?.threadId).toBe(targetThread.id);
  });

  it('does not scan for new messages without an index entry', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const thread = createThread();
    await memoryDomain.saveThread({ thread });

    const client = (memoryDomain as any).client as Redis;
    const scanSpy = vi.spyOn(client, 'scan');

    // Save a brand new message
    const message = createMessage(thread);
    await memoryDomain.saveMessages({ messages: [message] });

    // Should not scan — new message, no index, just skip
    expect(scanSpy).not.toHaveBeenCalled();

    // Message should exist
    const { messages } = await memoryDomain.listMessages({ threadId: thread.id });
    expect(messages.find(m => m.id === message.id)?.threadId).toBe(thread.id);
  });

  it('updates both touched thread timestamps when moving a message between threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    const beforeMoveSourceThread = await memoryDomain.getThreadById({ threadId: sourceThread.id });
    const beforeMoveTargetThread = await memoryDomain.getThreadById({ threadId: targetThread.id });

    await new Promise(resolve => setTimeout(resolve, 10));

    const movedMessage = createMessage(targetThread, {
      id: originalMessage.id,
      resourceId: targetThread.resourceId,
    });
    await memoryDomain.saveMessages({ messages: [movedMessage] });

    const afterMoveSourceThread = await memoryDomain.getThreadById({ threadId: sourceThread.id });
    const afterMoveTargetThread = await memoryDomain.getThreadById({ threadId: targetThread.id });

    expect(new Date(afterMoveSourceThread!.updatedAt).getTime()).toBeGreaterThan(
      new Date(beforeMoveSourceThread!.updatedAt).getTime(),
    );
    expect(new Date(afterMoveTargetThread!.updatedAt).getTime()).toBeGreaterThan(
      new Date(beforeMoveTargetThread!.updatedAt).getTime(),
    );
  });

  it('rejects the batch when any target thread does not exist', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const existingThread = createThread();
    const missingThread = createThread(existingThread.resourceId);
    await memoryDomain.saveThread({ thread: existingThread });

    const validMessage = createMessage(existingThread);
    const invalidMessage = createMessage(missingThread);

    await expect(
      memoryDomain.saveMessages({
        messages: [validMessage, invalidMessage],
      }),
    ).rejects.toThrow(`Thread ${missingThread.id} not found`);

    const { messages } = await memoryDomain.listMessages({ threadId: existingThread.id });
    expect(messages).toHaveLength(0);
  });
});

describe('updateMessages keeps msg-idx index in sync', () => {
  it('updates the index and returns the moved message when a message changes threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    const updatedMessages = await memoryDomain.updateMessages({
      messages: [{ id: originalMessage.id, threadId: targetThread.id }],
    });

    expect(updatedMessages).toHaveLength(1);
    expect(updatedMessages[0]!.threadId).toBe(targetThread.id);

    const client = (memoryDomain as any).client as Redis;
    expect(await client.get<string>(`msg-idx:${originalMessage.id}`)).toBe(targetThread.id);

    const { messages } = await memoryDomain.listMessagesById({ messageIds: [originalMessage.id] });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.threadId).toBe(targetThread.id);
  });

  it('rejects moving a message to a missing thread without mutating stored data', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const missingThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    await expect(
      memoryDomain.updateMessages({
        messages: [{ id: originalMessage.id, threadId: missingThread.id }],
      }),
    ).rejects.toThrow(`Thread ${missingThread.id} not found`);

    const client = (memoryDomain as any).client as Redis;
    expect(await client.get<string>(`msg-idx:${originalMessage.id}`)).toBe(sourceThread.id);

    const { messages } = await memoryDomain.listMessages({ threadId: sourceThread.id });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.threadId).toBe(sourceThread.id);
  });
});

describe('pg parity storage domains', () => {
  it('wires every persistent domain exposed by PostgresStore', () => {
    const store = new UpstashStore({
      id: `upstash-domain-parity-${randomUUID()}`,
      client: createTestClient(),
    });

    const domains = store.stores as Record<string, unknown>;
    expect(domains.agents).toBeDefined();
    expect(domains.blobs).toBeDefined();
    expect(domains.channels).toBeDefined();
    expect(domains.datasets).toBeDefined();
    expect(domains.experiments).toBeDefined();
    expect(domains.favorites).toBeDefined();
    expect(domains.mcpClients).toBeDefined();
    expect(domains.mcpServers).toBeDefined();
    expect(domains.notifications).toBeDefined();
    expect(domains.observability).toBeDefined();
    expect(domains.promptBlocks).toBeDefined();
    expect(domains.schedules).toBeDefined();
    expect(domains.scorerDefinitions).toBeDefined();
    expect(domains.skills).toBeDefined();
    expect(domains.toolProviderConnections).toBeDefined();
    expect(domains.workspaces).toBeDefined();
  });
});

describe('observational memory support', () => {
  it('returns resource messages from both indexed and unindexed storage rows', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const resourceId = `resource-${randomUUID()}`;
    const thread = createThread(resourceId);
    await memoryDomain.saveThread({ thread });

    const unindexedMessage = createMessage(thread, {
      id: `legacy-msg-${randomUUID()}`,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const indexedMessage = createMessage(thread, {
      id: `indexed-msg-${randomUUID()}`,
      createdAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    const client = (memoryDomain as any).client as Redis;
    await client.set(getKey(TABLE_MESSAGES, { threadId: thread.id, id: unindexedMessage.id }), unindexedMessage);

    await memoryDomain.saveMessages({ messages: [indexedMessage] });

    const listed = await memoryDomain.listMessagesByResourceId({
      resourceId,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    expect(listed.messages.map(message => message.id)).toEqual([unindexedMessage.id, indexedMessage.id]);
  });

  it('lists messages by resource id and persists observational memory history', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const resourceId = `resource-${randomUUID()}`;
    const thread = createThread(resourceId);
    await memoryDomain.saveThread({ thread });

    const firstMessage = createMessage(thread, {
      id: `msg-${randomUUID()}`,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const secondMessage = createMessage(thread, {
      id: `msg-${randomUUID()}`,
      createdAt: new Date('2024-01-02T00:00:00.000Z'),
    });
    await memoryDomain.saveMessages({ messages: [firstMessage, secondMessage] });

    const listed = await memoryDomain.listMessagesByResourceId({
      resourceId,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(listed.messages.map(message => message.id)).toEqual([firstMessage.id, secondMessage.id]);

    const record = await memoryDomain.initializeObservationalMemory({
      threadId: null,
      resourceId,
      scope: 'resource',
      config: { enabled: true },
    });
    await memoryDomain.updateActiveObservations({
      id: record.id,
      observations: 'User likes concise answers.',
      tokenCount: 5,
      lastObservedAt: secondMessage.createdAt,
      observedMessageIds: [firstMessage.id, secondMessage.id],
    });

    const current = await memoryDomain.getObservationalMemory(null, resourceId);
    expect(current?.activeObservations).toBe('User likes concise answers.');
    expect(current?.observedMessageIds).toEqual([firstMessage.id, secondMessage.id]);

    const history = await memoryDomain.getObservationalMemoryHistory(null, resourceId, 10);
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe(record.id);
  });
});
