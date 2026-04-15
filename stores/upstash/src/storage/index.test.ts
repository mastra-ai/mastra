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

describe('StoreMemoryUpstash saveMessages index behavior', () => {
  it('avoids scans for indexed message moves and updates all touched threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    const initialSourceThread = await memoryDomain.getThreadById({ threadId: sourceThread.id });
    const initialTargetThread = await memoryDomain.getThreadById({ threadId: targetThread.id });
    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    await new Promise(resolve => setTimeout(resolve, 10));

    const client = (memoryDomain as any).client as Redis;
    const scanSpy = vi.spyOn(client, 'scan');

    const movedMessage = createMessage(targetThread, {
      id: originalMessage.id,
      resourceId: targetThread.resourceId,
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Moved message' }],
        content: 'Moved message',
      },
    });

    await memoryDomain.saveMessages({ messages: [movedMessage] });

    expect(scanSpy).not.toHaveBeenCalled();

    const { messages: sourceMessages } = await memoryDomain.listMessages({ threadId: sourceThread.id });
    const { messages: targetMessages } = await memoryDomain.listMessages({ threadId: targetThread.id });
    expect(sourceMessages.find(message => message.id === originalMessage.id)).toBeUndefined();
    expect(targetMessages.find(message => message.id === originalMessage.id)?.threadId).toBe(targetThread.id);

    const updatedSourceThread = await memoryDomain.getThreadById({ threadId: sourceThread.id });
    const updatedTargetThread = await memoryDomain.getThreadById({ threadId: targetThread.id });
    expect(updatedSourceThread).not.toBeNull();
    expect(updatedTargetThread).not.toBeNull();
    expect(new Date(updatedSourceThread!.updatedAt).getTime()).toBeGreaterThan(
      new Date(initialSourceThread!.updatedAt).getTime(),
    );
    expect(new Date(updatedTargetThread!.updatedAt).getTime()).toBeGreaterThan(
      new Date(initialTargetThread!.updatedAt).getTime(),
    );
  });

  it('skips scan when the index is missing and treats message as new', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    const client = (memoryDomain as any).client as Redis;
    const messageIndexKey = `msg-idx:${originalMessage.id}`;
    await client.del(messageIndexKey);

    const scanSpy = vi.spyOn(client, 'scan');
    const movedMessage = createMessage(targetThread, {
      id: originalMessage.id,
      resourceId: targetThread.resourceId,
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Recovered message' }],
        content: 'Recovered message',
      },
    });

    await memoryDomain.saveMessages({ messages: [movedMessage] });

    // No scan should occur — unindexed messages are treated as new
    expect(scanSpy).not.toHaveBeenCalled();

    // Index should be recreated after the save
    await expect(client.get<string>(messageIndexKey)).resolves.toBe(targetThread.id);

    // Message now exists in target thread (source thread still has old copy since no scan found it)
    const { messages: targetMessages } = await memoryDomain.listMessages({ threadId: targetThread.id });
    expect(targetMessages.find(message => message.id === originalMessage.id)?.threadId).toBe(targetThread.id);
  });
});
