import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import { getMemoryTokenLimiterBoundary, setMemoryTokenLimiterBoundary } from '../../memory';
import { MockMemory } from '../../memory/mock';
import type { MemoryTokenLimiterBoundary } from '../../memory/types';
import { RequestContext } from '../../request-context';

import { MemoryTokenLimiter } from './memory-token-limiter';
import { MessageHistory } from './message-history';

function createMessage(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  threadId = 'thread-1',
  createdAt = new Date(),
): MastraDBMessage {
  return {
    id,
    threadId,
    role,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text }],
    },
    createdAt,
  };
}

function createAbort(): (reason?: string) => never {
  return (reason?: string) => {
    throw new Error(`Aborted: ${reason}`);
  };
}

/**
 * Create a processInput args payload with optional requestContext.
 */
function createProcessArgs(
  messageList: MessageList,
  overrides?: {
    systemMessages?: any[];
    requestContext?: RequestContext;
  },
) {
  return {
    messages: messageList.get.all.db(),
    messageList,
    abort: createAbort(),
    systemMessages: overrides?.systemMessages ?? [],
    state: {} as Record<string, unknown>,
    retryCount: 0,
    ...(overrides?.requestContext ? { requestContext: overrides.requestContext } : {}),
  };
}

/**
 * Helper to create a RequestContext with a thread that has memory token limiter boundary metadata.
 */
function createBoundaryContext(threadId: string, boundary: MemoryTokenLimiterBoundary): RequestContext {
  const ctx = new RequestContext();
  const thread = {
    id: threadId,
    metadata: setMemoryTokenLimiterBoundary(undefined, boundary),
  };
  ctx.set('MastraMemory', { thread, resourceId: 'test-resource', memoryConfig: {} });
  return ctx;
}

/**
 * Helper to create a RequestContext with a plain thread (no boundary, no metadata).
 */
function createThreadContext(threadId: string): RequestContext {
  const ctx = new RequestContext();
  const thread = { id: threadId, metadata: {} };
  ctx.set('MastraMemory', { thread, resourceId: 'test-resource', memoryConfig: {} });
  return ctx;
}

describe('MemoryTokenLimiter', () => {
  it('should not remove messages when under token limit', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 1_000_000 });
    const messageList = new MessageList();

    const memoryMsg = createMessage('mem-1', 'user', 'Hello from memory');
    messageList.add(memoryMsg, 'memory');

    const inputMsg = createMessage('input-1', 'user', 'New input message');
    messageList.add(inputMsg, 'input');

    await limiter.processInput(createProcessArgs(messageList));

    expect(messageList.get.all.db()).toHaveLength(2);
    expect(messageList.get.remembered.db()).toHaveLength(1);
  });

  it('should remove oldest memory messages when over token limit', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
    const messageList = new MessageList();

    const longText = 'x'.repeat(2000);
    const memoryMsg1 = createMessage('mem-1', 'user', longText);
    const memoryMsg2 = createMessage('mem-2', 'assistant', longText);
    messageList.add(memoryMsg1, 'memory');
    messageList.add(memoryMsg2, 'memory');

    const inputMsg = createMessage('input-1', 'user', 'Hi');
    messageList.add(inputMsg, 'input');

    await limiter.processInput(createProcessArgs(messageList));

    const remaining = messageList.get.all.db();
    const remainingIds = remaining.map(m => m.id);

    expect(remainingIds).toContain('input-1');
    expect(messageList.get.remembered.db()).toHaveLength(0);
  });

  it('should never remove input messages', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
    const messageList = new MessageList();

    const largeInput = createMessage('input-1', 'user', 'x'.repeat(1000));
    messageList.add(largeInput, 'input');

    const memoryMsg = createMessage('mem-1', 'user', 'Hi');
    messageList.add(memoryMsg, 'memory');

    await limiter.processInput(createProcessArgs(messageList));

    const inputMessages = messageList.get.input.db();
    expect(inputMessages).toHaveLength(1);
    expect(inputMessages[0]!.id).toBe('input-1');

    const memoryMessages = messageList.get.remembered.db();
    expect(memoryMessages).toHaveLength(0);
  });

  it('should remove memory messages in chronological order (oldest first)', async () => {
    // Each memory message with longText ≈ 265 tokens with CoreTokenCounter overhead (3.8 TOKENS_PER_MESSAGE + role).
    // mem-3 ("Hi") ≈ 6 tokens, input-1 ("Hi") ≈ 6 tokens.
    // Total ≈ 542 tokens. MaxTokens=100, atMaxRemoveTokens default=25, target=75.
    // Removing mem-1 (265 tokens) → 277 remaining, removing mem-2 (265 tokens) → 12 remaining which is ≤ 75.
    // So mem-1 and mem-2 are removed, mem-3 stays.
    const limiter = new MemoryTokenLimiter({ maxTokens: 100 });
    const messageList = new MessageList();

    const baseTime = new Date('2025-01-01T00:00:00Z');
    const longText = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');

    messageList.add(createMessage('mem-1', 'user', longText, 'thread-1', new Date(baseTime.getTime())), 'memory');
    messageList.add(
      createMessage('mem-2', 'assistant', longText, 'thread-1', new Date(baseTime.getTime() + 1000)),
      'memory',
    );
    messageList.add(createMessage('mem-3', 'user', 'Hi', 'thread-1', new Date(baseTime.getTime() + 2000)), 'memory');

    messageList.add(createMessage('input-1', 'user', 'Hi', 'thread-1', new Date(baseTime.getTime() + 3000)), 'input');

    await limiter.processInput(createProcessArgs(messageList));

    const remainingMemory = messageList.get.remembered.db();
    const remainingIds = remainingMemory.map(m => m.id);

    expect(remainingIds).not.toContain('mem-1');
    expect(remainingIds).not.toContain('mem-2');
    expect(remainingIds).toContain('mem-3');

    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should have the correct processor id', () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 100_000 });
    expect(limiter.id).toBe('memory-token-limiter');
  });

  it('should account for system message tokens in the budget', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 20 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hello from memory'), 'memory');
    messageList.add(createMessage('input-1', 'user', 'Hi'), 'input');

    const largeSystemPrompt = 'You are a helpful assistant. '.repeat(10);

    await limiter.processInput(
      createProcessArgs(messageList, {
        systemMessages: [{ role: 'system' as const, content: largeSystemPrompt }],
      }),
    );

    expect(messageList.get.remembered.db()).toHaveLength(0);
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should remove all memory messages when maxTokens is 0', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 0 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hello'), 'memory');
    messageList.add(createMessage('mem-2', 'assistant', 'Hi there'), 'memory');
    messageList.add(createMessage('input-1', 'user', 'New message'), 'input');

    await limiter.processInput(createProcessArgs(messageList));

    expect(messageList.get.remembered.db()).toHaveLength(0);
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should handle no memory messages gracefully', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 10 });
    const messageList = new MessageList();

    messageList.add(createMessage('input-1', 'user', 'x'.repeat(1000)), 'input');

    await limiter.processInput(createProcessArgs(messageList));

    expect(messageList.get.input.db()).toHaveLength(1);
    expect(messageList.get.all.db()).toHaveLength(1);
  });

  it('should preserve input messages even when they alone exceed maxTokens', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
    const messageList = new MessageList();

    messageList.add(createMessage('input-1', 'user', 'x'.repeat(5000)), 'input');
    messageList.add(createMessage('mem-1', 'user', 'Hi'), 'memory');

    await limiter.processInput(createProcessArgs(messageList));

    expect(messageList.get.remembered.db()).toHaveLength(0);
    expect(messageList.get.input.db()).toHaveLength(1);
    expect(messageList.get.input.db()[0]!.id).toBe('input-1');
  });

  it('should drop to atMaxRemoveTokens below maxTokens when over budget', async () => {
    // Each memory message with 'x'.repeat(400) ≈ 55 tokens with CoreTokenCounter overhead.
    // input-1 ('Hi') ≈ 6 tokens. Total ≈ 171 tokens.
    // maxTokens=140, atMaxRemoveTokens=60 → target = 80
    // Removing mem-0: 171 - 55 = 116 (still > 80) → keep removing
    // Removing mem-1: 116 - 55 = 61 (≤ 80) → stop
    // → mem-0 and mem-1 removed, mem-2 stays
    const limiter = new MemoryTokenLimiter({ maxTokens: 140, atMaxRemoveTokens: 60 });
    const messageList = new MessageList();
    const ctx = createThreadContext('thread-1');

    // ~50 estimated tokens each (exclusive of overhead)
    const medText = 'x'.repeat(400);

    messageList.add(createMessage('mem-0', 'user', medText, 'thread-1', new Date('2025-01-01T00:00:00Z')), 'memory');
    messageList.add(createMessage('mem-1', 'user', medText, 'thread-1', new Date('2025-01-01T00:00:01Z')), 'memory');
    messageList.add(createMessage('mem-2', 'user', medText, 'thread-1', new Date('2025-01-01T00:00:02Z')), 'memory');
    messageList.add(createMessage('input-1', 'user', 'Hi', 'thread-1', new Date('2025-01-01T00:00:03Z')), 'input');

    await limiter.processInput(createProcessArgs(messageList, { requestContext: ctx }));

    // Oldest messages removed first to get below target
    const memoryIds = messageList.get.remembered.db().map(m => m.id);
    expect(memoryIds).not.toContain('mem-0');
    expect(memoryIds).not.toContain('mem-1');
    // mem-2 should remain since we reached the target
    expect(memoryIds).toContain('mem-2');

    // Input preserved
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should persist the newest removed message as the thread boundary in metadata', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
    const messageList = new MessageList();
    const ctx = createThreadContext('thread-1');

    const longText = 'x'.repeat(2000);

    messageList.add(createMessage('mem-1', 'user', longText, 'thread-1', new Date('2025-01-01T00:00:00Z')), 'memory');
    messageList.add(
      createMessage('mem-2', 'assistant', longText, 'thread-1', new Date('2025-01-01T00:00:01Z')),
      'memory',
    );
    messageList.add(createMessage('input-1', 'user', 'Hi', 'thread-1', new Date('2025-01-01T00:00:02Z')), 'input');

    await limiter.processInput(createProcessArgs(messageList, { requestContext: ctx }));

    // Get the thread from the context and check the boundary
    const memoryContext = ctx.get('MastraMemory') as
      | { thread?: { id: string; metadata?: Record<string, unknown> } }
      | undefined;
    const thread = memoryContext?.thread;
    expect(thread).toBeDefined();
    expect(thread!.metadata).toBeDefined();

    const boundary = getMemoryTokenLimiterBoundary(thread!.metadata!);
    expect(boundary).toBeDefined();
    expect(boundary!.messageId).toBe('mem-2'); // newest removed message
    expect(boundary!.maxTokens).toBe(5);
    expect(boundary!.atMaxRemoveTokens).toBe(1); // 25% of 5 = 1.25 rounded to 1
    expect(boundary!.targetTokens).toBe(4); // 5 - 1 = 4
    expect(boundary!.tokenCounterSource).toBe('v7:tokenx');
    expect(boundary!.createdAt).toBeDefined();
    expect(boundary!.updatedAt).toBeDefined();
  });

  it('should not persist a boundary when no messages are removed', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 1_000_000 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hi', 'thread-1', new Date('2025-01-01T00:00:00Z')), 'memory');
    messageList.add(createMessage('input-1', 'user', 'Hi', 'thread-1', new Date('2025-01-01T00:00:01Z')), 'input');

    await limiter.processInput(createProcessArgs(messageList));

    expect(messageList.get.remembered.db()).toHaveLength(1);
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should ignore stale boundary when maxTokens config changes', async () => {
    // Create a stale boundary with old maxTokens=5
    const staleBoundary: MemoryTokenLimiterBoundary = {
      messageId: 'mem-2',
      createdAt: new Date('2025-01-01T00:00:01Z').toISOString(),
      droppedFromTokens: 5,
      targetTokens: 4,
      maxTokens: 5,
      atMaxRemoveTokens: 1,
      tokenCounterSource: 'v7:tokenx',
      updatedAt: new Date('2025-01-01T00:00:02Z').toISOString(),
    };

    const ctx = createBoundaryContext('thread-1', staleBoundary);

    // New limiter with very different maxTokens (too small)
    const limiter = new MemoryTokenLimiter({ maxTokens: 3, atMaxRemoveTokens: 0 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hello', 'thread-1', new Date('2025-01-01T00:00:00Z')), 'memory');
    messageList.add(createMessage('mem-2', 'user', 'World', 'thread-1', new Date('2025-01-01T00:00:01Z')), 'memory');
    messageList.add(
      createMessage('input-1', 'user', 'Subsequent turn', 'thread-1', new Date('2025-01-01T00:00:03Z')),
      'input',
    );

    await limiter.processInput(createProcessArgs(messageList, { requestContext: ctx }));

    // The limiter should have removed messages since total > maxTokens (3)
    // Even though the stale boundary says 5 was the old max
    expect(messageList.get.remembered.db()).toHaveLength(0);
  });

  it('should cache token estimates on part.providerMetadata.mastra.tokenEstimate', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 1_000_000 });
    const messageList = new MessageList();

    const msg1 = createMessage('mem-1', 'user', 'Hello world');
    messageList.add(msg1, 'memory');

    const input = createMessage('input-1', 'user', 'Test');
    messageList.add(input, 'input');

    await limiter.processInput(createProcessArgs(messageList));

    // Verify token estimate was cached on the part's providerMetadata
    const allMessages = messageList.get.all.db();
    for (const message of allMessages) {
      if (typeof message.content === 'object' && message.content && Array.isArray(message.content.parts)) {
        for (const part of message.content.parts) {
          const partMeta = (part as any).providerMetadata?.mastra;
          expect(partMeta).toBeDefined();
          expect(partMeta.tokenEstimate).toBeDefined();

          const entry = partMeta.tokenEstimate as { v: number; source: string; key: string; tokens: number };
          expect(entry.v).toBe(7);
          expect(entry.source).toBe('v7:tokenx');
          expect(typeof entry.key).toBe('string');
          expect(typeof entry.tokens).toBe('number');
          // Each text part should have a small positive token count
          expect(entry.tokens).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should default atMaxRemoveTokens to 25% of maxTokens when not specified', async () => {
    // atMaxRemoveTokens defaults to Math.max(1, floor(0.25 * maxTokens))
    const limiter100 = new MemoryTokenLimiter({ maxTokens: 100 });
    const limiter1 = new MemoryTokenLimiter({ maxTokens: 1 });
    const limiterLarge = new MemoryTokenLimiter({ maxTokens: 1_000_000 });

    // Internal detail: check via reflection since it's private
    // We can verify behaviorally: maxTokens=100 → atMaxRemoveTokens should be 25
    // maxTokens=1 → atMaxRemoveTokens should be 1 (min 1)
    // maxTokens=1,000,000 → atMaxRemoveTokens should be 250,000
    expect((limiter100 as any).atMaxRemoveTokens).toBe(25);
    expect((limiter1 as any).atMaxRemoveTokens).toBe(1);
    expect((limiterLarge as any).atMaxRemoveTokens).toBe(250_000);
  });
});

describe('Memory.getInputProcessors with nested lastMessages', () => {
  it('should auto-add MemoryTokenLimiter when lastMessages has maxTokens configured', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: { maxTokens: 100_000 },
    };

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeDefined();
  });

  it('should NOT add MemoryTokenLimiter when lastMessages is a number only', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: 10,
    };

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeUndefined();
  });

  it('should auto-add MemoryTokenLimiter with atMaxRemoveTokens from nested config', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: { maxTokens: 50_000, atMaxRemoveTokens: 20_000 },
    };

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeDefined();
    expect((tokenLimiter as any).maxTokens).toBe(50_000);
    expect((tokenLimiter as any).atMaxRemoveTokens).toBe(20_000);
  });

  it('should NOT add MemoryTokenLimiter when lastMessages is false', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: false,
    };

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeUndefined();
  });

  it('should NOT add MemoryTokenLimiter when lastMessages object has no maxTokens', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: { maxMessages: 50 },
    };

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeUndefined();
  });

  it('should add MessageHistory with maxMessages when lastMessages object has maxMessages', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: { maxMessages: 50 },
    };

    const processors = await memory.getInputProcessors();
    const historyProcessor = processors.find(p => p.id === 'message-history');
    expect(historyProcessor).toBeDefined();
    expect((historyProcessor as any).lastMessages).toBe(50);
  });

  it('should use no count cap when object lastMessages omits maxMessages', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: { maxTokens: 100_000 },
    };

    const processors = await memory.getInputProcessors();
    const historyProcessor = processors.find(p => p.id === 'message-history');
    expect(historyProcessor).toBeDefined();
    expect((historyProcessor as any).lastMessages).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should use no count cap when object maxMessages is false', async () => {
    const memory = new MockMemory();
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      lastMessages: { maxMessages: false },
    };

    const processors = await memory.getInputProcessors();
    const historyProcessor = processors.find(p => p.id === 'message-history');
    expect(historyProcessor).toBeDefined();
    expect((historyProcessor as any).lastMessages).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should fetch uncapped token-limited history in bounded pages', async () => {
    const storage = {
      listMessages: vi.fn(async ({ page = 0, perPage }: { page?: number; perPage?: number | false }) => ({
        messages: Array.from({ length: perPage as number }, (_, index) =>
          createMessage(
            `mem-${page}-${index}`,
            index % 2 === 0 ? 'user' : 'assistant',
            'x'.repeat(1000),
            'thread-1',
            new Date(new Date('2024-01-01T10:00:00Z').getTime() + index * 1000),
          ),
        ),
        total: 1_000_000,
        page,
        perPage,
        hasMore: true,
      })),
    };

    const history = new MessageHistory({
      storage: storage as any,
      lastMessages: Number.MAX_SAFE_INTEGER,
      tokenLimit: { maxTokens: 100 },
    });
    const messageList = new MessageList();
    messageList.add(createMessage('input-1', 'user', 'Hi'), 'input');

    await history.processInput(createProcessArgs(messageList, { requestContext: createThreadContext('thread-1') }));

    expect(storage.listMessages).toHaveBeenCalledTimes(1);
    expect(storage.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 0,
        perPage: 20,
      }),
    );
  });

  it('should paginate uncapped token-limited history backwards by createdAt cursor', async () => {
    const firstBatch = Array.from({ length: 20 }, (_, index) =>
      createMessage(
        `mem-new-${index}`,
        index % 2 === 0 ? 'user' : 'assistant',
        'hi',
        'thread-1',
        new Date(new Date('2024-01-01T10:20:00Z').getTime() - index * 1000),
      ),
    );
    const secondBatch = Array.from({ length: 5 }, (_, index) =>
      createMessage(
        `mem-old-${index}`,
        index % 2 === 0 ? 'user' : 'assistant',
        'hi',
        'thread-1',
        new Date(new Date('2024-01-01T09:20:00Z').getTime() - index * 1000),
      ),
    );
    const storage = {
      listMessages: vi.fn(
        async ({ filter, page = 0, perPage }: { filter?: any; page?: number; perPage?: number | false }) => {
          const isSecondPage = Boolean(filter?.dateRange?.end);
          return {
            messages: isSecondPage ? secondBatch : firstBatch,
            total: 25,
            page,
            perPage,
            hasMore: !isSecondPage,
          };
        },
      ),
    };

    const history = new MessageHistory({
      storage: storage as any,
      lastMessages: Number.MAX_SAFE_INTEGER,
      tokenLimit: { maxTokens: 10_000 },
    });

    await history.processInput(
      createProcessArgs(new MessageList(), { requestContext: createThreadContext('thread-1') }),
    );

    expect(storage.listMessages).toHaveBeenCalledTimes(2);
    expect(storage.listMessages).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 0,
        perPage: 20,
        filter: expect.objectContaining({
          dateRange: expect.objectContaining({
            end: firstBatch.at(-1)!.createdAt,
            endExclusive: true,
          }),
        }),
      }),
    );
  });

  it('should ignore stale token limiter boundaries when the limiter config changes', async () => {
    const storage = {
      listMessages: vi.fn(async (_options: any) => ({
        messages: [],
        total: 0,
        page: 0,
        perPage: 10,
        hasMore: false,
      })),
    };
    const staleBoundary: MemoryTokenLimiterBoundary = {
      messageId: 'mem-old-boundary',
      createdAt: '2024-01-01T10:00:00.000Z',
      droppedFromTokens: 100,
      targetTokens: 75,
      maxTokens: 50,
      atMaxRemoveTokens: 12,
      tokenCounterSource: 'v7:tokenx',
      updatedAt: '2024-01-01T10:00:00.000Z',
    };

    const history = new MessageHistory({
      storage: storage as any,
      lastMessages: 10,
      tokenLimit: { maxTokens: 100 },
    });

    await history.processInput(
      createProcessArgs(new MessageList(), {
        requestContext: createBoundaryContext('thread-1', staleBoundary),
      }),
    );

    expect(storage.listMessages.mock.calls[0]![0].filter).toBeUndefined();
  });

  it('should persist the actual pre-trim token total in boundary metadata', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 100, atMaxRemoveTokens: 10 });
    const messageList = new MessageList();
    const ctx = createThreadContext('thread-1');

    messageList.add(createMessage('mem-1', 'user', 'x'.repeat(2000)), 'memory');
    messageList.add(createMessage('mem-2', 'assistant', 'x'.repeat(2000)), 'memory');
    messageList.add(createMessage('input-1', 'user', 'Hi'), 'input');

    await limiter.processInput(createProcessArgs(messageList, { requestContext: ctx }));

    const memoryContext = ctx.get('MastraMemory') as { thread?: { metadata?: Record<string, unknown> } };
    const boundary = getMemoryTokenLimiterBoundary(memoryContext.thread?.metadata, {
      maxTokens: 100,
      atMaxRemoveTokens: 10,
      tokenCounterSource: 'v7:tokenx',
    });

    expect(boundary).toBeDefined();
    expect(boundary!.droppedFromTokens).toBeGreaterThan(boundary!.maxTokens);
  });

  it('should validate token limiter options', () => {
    expect(() => new MemoryTokenLimiter({ maxTokens: -1 })).toThrow(/maxTokens/);
    expect(() => new MemoryTokenLimiter({ maxTokens: Infinity })).toThrow(/maxTokens/);
    expect(() => new MemoryTokenLimiter({ maxTokens: 100, atMaxRemoveTokens: -1 })).toThrow(/atMaxRemoveTokens/);
  });

  it('should account for structured system message content in the budget', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 20 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hello from memory'), 'memory');
    messageList.add(createMessage('input-1', 'user', 'Hi'), 'input');

    await limiter.processInput(
      createProcessArgs(messageList, {
        systemMessages: [
          { role: 'system' as const, content: [{ type: 'text', text: 'You are helpful. '.repeat(20) }] },
        ],
      }),
    );

    expect(messageList.get.remembered.db()).toHaveLength(0);
    expect(messageList.get.input.db()).toHaveLength(1);
  });
});
