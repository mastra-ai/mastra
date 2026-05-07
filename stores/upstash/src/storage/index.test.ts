import { randomUUID } from 'node:crypto';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { Redis } from '@upstash/redis';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreMemoryUpstash } from './domains/memory';
import { ScoresUpstash } from './domains/scores';
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
