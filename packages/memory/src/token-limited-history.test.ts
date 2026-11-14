import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { TokenCounter } from './processors/observational-memory/token-counter';
import { Memory } from './index';

const messages: MastraDBMessage[] = Array.from({ length: 15 }, (_, i) => ({
  id: `message-${i}`,
  role: 'user',
  threadId: 'thread',
  resourceId: 'resource',
  createdAt: new Date(1700000000000 + i * 1000),
  content: { format: 2, parts: [{ type: 'text', text: 'A historical conversation message. '.repeat(30) }] },
}));

describe('messageHistory history', () => {
  it('normalizes pagination without imposing the default message count on token-only history', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({ storage, options: { messageHistory: { maxTokens: 1000 } } });
    await memory.saveThread({
      thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
    });
    const store = (await storage.getStore('memory'))!;
    await store.saveMessages({ messages });
    const listMessages = vi.spyOn(store, 'listMessages');
    const recalled = await memory.recall({ threadId: 'thread', resourceId: 'resource' });
    expect(recalled.messages.length).toBeGreaterThan(0);
    expect(recalled.messages.length).toBeLessThan(messages.length);
    expect(recalled.messages.at(-1)?.id).toBe('message-14');
    expect(listMessages).not.toHaveBeenCalledWith(expect.objectContaining({ perPage: false }));
    expect(listMessages.mock.calls.every(([input]) => input.includeTotal === false)).toBe(true);
    expect(
      (
        await memory.recall({
          threadId: 'thread',
          resourceId: 'resource',
          threadConfig: { lastMessages: 3 },
        })
      ).messages.map(m => m.id),
    ).toEqual(['message-13', 'message-14']);
    expect(
      (
        await memory.recall({
          threadId: 'thread',
          resourceId: 'resource',
          threadConfig: { lastMessages: 0 },
        })
      ).messages,
    ).toEqual([]);
    expect(
      (await memory.recall({ threadId: 'thread', resourceId: 'resource', threadConfig: { lastMessages: false } }))
        .messages,
    ).toEqual([]);
    expect(
      (
        await memory.recall({
          threadId: 'thread',
          resourceId: 'resource',
          perPage: false,
          threadConfig: { lastMessages: false },
        })
      ).messages,
    ).toHaveLength(15);
  });

  it('treats a zero token budget as disabled before thread validation', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    const listMessages = vi.spyOn(store, 'listMessages');
    const getThread = vi.spyOn(store, 'getThreadById');
    const memory = new Memory({ storage, options: { messageHistory: { maxTokens: 0 } } });

    await expect(memory.recall({ threadId: 'missing', resourceId: 'resource' })).resolves.toMatchObject({
      messages: [],
    });
    expect(listMessages).not.toHaveBeenCalled();
    expect(getThread).not.toHaveBeenCalled();
  });

  it('bounds direct context retrieval and respects matching persisted boundaries', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({ storage, options: { messageHistory: { maxTokens: 500, atMaxRemoveTokens: 100 } } });
    await memory.saveThread({
      thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
    });
    const store = (await storage.getStore('memory'))!;
    await store.saveMessages({ messages });
    const context = await memory.getContext({ threadId: 'thread', resourceId: 'resource' });
    const counter = new TokenCounter();
    expect(context.messages.length).toBeGreaterThan(0);
    expect(context.messages.length).toBeLessThan(messages.length);
    expect(context.messages.at(-1)?.id).toBe('message-14');
    expect(context.messages.reduce((total, message) => total + counter.countMessage(message), 24)).toBeLessThanOrEqual(
      400,
    );

    await store.patchThread({
      id: 'thread',
      metadata: {
        memoryTokenLimiter: {
          createdAt: messages[14]!.createdAt.toISOString(),
          messageIds: ['message-14'],
          maxTokens: 500,
          atMaxRemoveTokens: 100,
        },
      },
    });
    expect((await memory.getContext({ threadId: 'thread' })).messages).toEqual([]);
    // A runtime count cap layers on the configured token budget, so the persisted boundary still applies.
    expect((await memory.getContext({ threadId: 'thread', memoryConfig: { lastMessages: 3 } })).messages).toEqual([]);
    // A different budget invalidates the persisted boundary.
    expect(
      (await memory.getContext({ threadId: 'thread', memoryConfig: { messageHistory: { maxTokens: 10000 } } }))
        .messages,
    ).toHaveLength(15);
  });

  it('applies a thread boundary only to semantic results from that thread', async () => {
    const storage = new InMemoryStore();
    const currentThreadId = 'current-thread';
    const otherThreadId = 'other-thread';
    const resourceId = 'shared-resource';
    const currentOld: MastraDBMessage = {
      id: 'current-old',
      role: 'user',
      threadId: currentThreadId,
      resourceId,
      createdAt: new Date('2024-01-01T00:00:30Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'old current-thread message' }] },
    };
    const otherHit: MastraDBMessage = {
      id: 'other-hit',
      role: 'user',
      threadId: otherThreadId,
      resourceId,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'old cross-thread semantic hit' }] },
    };
    const otherNeighbor: MastraDBMessage = {
      id: 'other-neighbor',
      role: 'assistant',
      threadId: otherThreadId,
      resourceId,
      createdAt: new Date('2024-01-01T00:01:00Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'requested cross-thread neighbor' }] },
    };
    const currentNew: MastraDBMessage = {
      id: 'current-new',
      role: 'assistant',
      threadId: currentThreadId,
      resourceId,
      createdAt: new Date('2024-01-03T00:00:00Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'new current-thread message' }] },
    };
    const resourceResults = [
      { id: 'current-vector', score: 0.9, metadata: { message_id: currentOld.id, thread_id: currentThreadId } },
      { id: 'other-vector', score: 0.9, metadata: { message_id: otherHit.id, thread_id: otherThreadId } },
    ];
    const vector: MastraVector = {
      createIndex: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue(undefined),
      query: vi
        .fn()
        .mockImplementation(({ filter }: { filter: Record<string, string> }) =>
          Promise.resolve(filter.thread_id ? resourceResults.slice(0, 1) : resourceResults),
        ),
      listIndexes: vi.fn().mockResolvedValue([]),
      deleteVectors: vi.fn().mockResolvedValue(undefined),
      describeIndex: vi.fn().mockResolvedValue({ dimension: 3 }),
      id: 'boundary-vector',
    } as any;
    const embedder = {
      doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]], usage: { tokens: 3 } }),
      modelId: 'boundary-embedder',
      specificationVersion: 'v1',
      provider: 'mock',
    } as any;
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        messageHistory: { maxTokens: 10_000, atMaxRemoveTokens: 0 },
        semanticRecall: { scope: 'resource', topK: 2, messageRange: { before: 0, after: 1 } },
        generateTitle: false,
      },
    });

    await memory.saveThread({
      thread: {
        id: currentThreadId,
        resourceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          memoryTokenLimiter: {
            createdAt: '2024-01-02T00:00:00.000Z',
            messageIds: [],
            maxTokens: 10_000,
            atMaxRemoveTokens: 0,
          },
        },
      },
    });
    await memory.saveThread({
      thread: { id: otherThreadId, resourceId, createdAt: new Date(), updatedAt: new Date() },
    });
    await memory.saveMessages({ messages: [currentOld, otherHit, otherNeighbor, currentNew] });

    const resourceRecall = await memory.recall({
      threadId: currentThreadId,
      resourceId,
      vectorSearchString: 'remember',
    });
    expect(resourceRecall.messages.map(message => message.id)).toEqual(['other-hit', 'other-neighbor', 'current-new']);

    const threadRecall = await memory.recall({
      threadId: currentThreadId,
      resourceId,
      vectorSearchString: 'remember',
      threadConfig: { semanticRecall: { scope: 'thread', topK: 2, messageRange: 1 } },
    });
    expect(threadRecall.messages.map(message => message.id)).toEqual(['current-new']);
  });

  it('uses the observational-memory counter in the automatically injected limiter', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({ storage, options: { messageHistory: { maxTokens: 500, atMaxRemoveTokens: 100 } } });
    const thread = await memory.saveThread({
      thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
    });
    await (await storage.getStore('memory'))!.saveMessages({ messages });
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread, resourceId: 'resource' });
    const processors = await memory.getInputProcessors([], requestContext);
    const messageList = new MessageList();
    const counter = vi.spyOn(TokenCounter.prototype, 'countMessage');
    try {
      for (const processor of processors) {
        const args: ProcessInputArgs = {
          messageList,
          messages: messageList.get.all.db(),
          requestContext,
          systemMessages: [],
          state: {},
          retryCount: 0,
          abort: reason => {
            throw new Error(reason);
          },
        };
        await processor.processInput?.(args);
      }
      expect(counter).toHaveBeenCalled();
      expect(messageList.get.all.db().length).toBeLessThan(messages.length);
      expect(messageList.get.all.db().at(-1)?.id).toBe('message-14');
      const saved = await memory.getThreadById({ threadId: 'thread' });
      expect(saved?.metadata?.memoryTokenLimiter).toBeDefined();
    } finally {
      counter.mockRestore();
    }
  });
});
