import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import type { ProcessInputArgs } from '../processors';
import { MessageHistory } from '../processors/memory/message-history';
import { TokenLimiterProcessor } from '../processors/processors/token-limiter';
import { RequestContext } from '../request-context';
import { InMemoryStore, MemoryStorage } from '../storage';
import { loadMessageHistory } from './load-message-history';
import {
  advanceMemoryTokenBoundary,
  getMemoryTokenBoundary,
  mergeMemoryTokenBoundaries,
  normalizeMessageHistoryConfig,
} from './message-history-config';
import { MockMemory } from './mock';

const message = (id: string, seconds = 0): MastraDBMessage => ({
  id,
  role: 'user',
  threadId: 'thread',
  resourceId: 'resource',
  createdAt: new Date(1700000000000 + seconds * 1000),
  content: { format: 2, parts: [{ type: 'text', text: id }] },
});
const args = (messageList: MessageList, requestContext?: RequestContext): ProcessInputArgs => ({
  messageList,
  messages: messageList.get.all.db(),
  systemMessages: [],
  state: {},
  retryCount: 0,
  abort: reason => {
    throw new Error(reason);
  },
  requestContext,
});

describe('token-based memory history', () => {
  it('resolves lastMessages and messageHistory into one history config', () => {
    expect(normalizeMessageHistoryConfig(5)).toEqual({ enabled: true, maxMessages: 5 });
    expect(normalizeMessageHistoryConfig(false).enabled).toBe(false);
    expect(normalizeMessageHistoryConfig(undefined, { maxTokens: 100 })).toEqual({
      enabled: true,
      maxMessages: undefined,
      maxTokens: 100,
      atMaxRemoveTokens: 25,
    });
    expect(normalizeMessageHistoryConfig(3, { maxTokens: 100, atMaxRemoveTokens: 10 })).toMatchObject({
      maxMessages: 3,
      maxTokens: 100,
      atMaxRemoveTokens: 10,
    });
    expect(normalizeMessageHistoryConfig(false, { maxTokens: 100 }).enabled).toBe(false);
    expect(normalizeMessageHistoryConfig(undefined, { maxTokens: 0 }).enabled).toBe(false);
    expect(normalizeMessageHistoryConfig(3, { maxTokens: 0 }).enabled).toBe(false);
    for (const tokens of [
      { maxTokens: NaN },
      { maxTokens: Infinity },
      { maxTokens: -1 },
      { maxTokens: 5, atMaxRemoveTokens: 6 },
      { maxTokens: 5, atMaxRemoveTokens: -1 },
    ]) {
      expect(() => normalizeMessageHistoryConfig(undefined, tokens)).toThrow('messageHistory');
    }
  });

  it.each([-1, 1.5, NaN, Infinity])('rejects invalid scalar message limit %s', value => {
    expect(() => normalizeMessageHistoryConfig(value)).toThrow('finite non-negative integer');
  });

  it('preserves disabled and unspecified scalar limits', () => {
    expect(normalizeMessageHistoryConfig(0)).toEqual({ enabled: false, maxMessages: 0 });
    expect(normalizeMessageHistoryConfig(undefined)).toEqual({ enabled: false, maxMessages: undefined });
  });

  it('preserves explicit MockMemory history disablement', async () => {
    const withCount = new MockMemory({ enableMessageHistory: false, options: { lastMessages: 5 } });
    const withTokens = new MockMemory({
      enableMessageHistory: false,
      options: { messageHistory: { maxTokens: 100 } },
    });

    expect((withCount as any).threadConfig.lastMessages).toBe(false);
    expect((withTokens as any).threadConfig.lastMessages).toBe(false);
    expect(await withCount.getInputProcessors()).toEqual([]);
    expect(await withTokens.getInputProcessors()).toEqual([]);
  });

  it('drops the default count window when only messageHistory is configured', async () => {
    const withTokens = new MockMemory({ options: { messageHistory: { maxTokens: 100 } } });
    expect((withTokens as any).threadConfig.lastMessages).toBeUndefined();
    const withBoth = new MockMemory({ options: { lastMessages: 4, messageHistory: { maxTokens: 100 } } });
    expect((withBoth as any).threadConfig.lastMessages).toBe(4);
    const withExplicitDefault = new MockMemory({ options: { lastMessages: 10 } });
    expect(withExplicitDefault.getMergedThreadConfig({ messageHistory: { maxTokens: 100 } }).lastMessages).toBe(10);
  });

  it('adds its memory limiter when a user token limiter is also configured', async () => {
    const memory = new MockMemory({ options: { messageHistory: { maxTokens: 100 } } });
    const processors = await memory.getInputProcessors([new TokenLimiterProcessor(1_000)]);

    const limiter = processors.find(processor => processor.id === 'memory-token-limiter');
    expect(limiter).toBeDefined();
    expect(limiter?.processInputStep).toBeTypeOf('function');
  });

  it('drops a chunk of oldest history and protects every current-turn source', async () => {
    const list = new MessageList();
    list.add([message('old', 0), message('recent', 1)], 'memory');
    list.add(message('input', 2), 'input');
    list.add(message('output', 3), 'response');
    list.add(message('context', 4), 'context');
    const onMemoryTrim = vi.fn(async () => {});
    const limiter = new TokenLimiterProcessor({
      limit: 500,
      trimMode: 'memory-only',
      atMaxRemoveTokens: 200,
      tokenCounter: { countMessage: () => 100 },
      onMemoryTrim,
    });
    await limiter.processInput(args(list));
    expect(list.get.all.db().map(m => m.id)).toEqual(['input', 'output', 'context']);
    expect(onMemoryTrim.mock.calls).toHaveLength(1);
    await expect(limiter.processInput(args(list))).resolves.toBe(list);
    expect(onMemoryTrim.mock.calls).toHaveLength(1);
  });

  it('trims linked tool-call and tool-result messages atomically', async () => {
    const toolMessage = (id: string, state: 'call' | 'result', seconds: number): MastraDBMessage => ({
      ...message(id, seconds),
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state,
              toolCallId: 'tool-call',
              toolName: 'lookup',
              args: {},
              ...(state === 'result' ? { result: 'done' } : {}),
            },
          },
        ],
      },
    });
    const list = new MessageList();
    list.add([toolMessage('call', 'call', 0), toolMessage('result', 'result', 1), message('recent', 2)], 'memory');
    list.add(message('input', 3), 'input');
    const onMemoryTrim = vi.fn(async () => {});
    const limiter = new TokenLimiterProcessor({
      limit: 350,
      trimMode: 'memory-only',
      atMaxRemoveTokens: 100,
      tokenCounter: { countMessage: () => 100 },
      onMemoryTrim,
    });

    await limiter.processInput(args(list));

    expect(onMemoryTrim).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'call' }), expect.objectContaining({ id: 'result' })]),
      undefined,
    );
    expect(list.get.all.db().map(item => item.id)).toEqual(['recent', 'input']);
  });

  it('does not throw or delete protected input when it alone exceeds the budget', async () => {
    const list = new MessageList();
    list.addSystem('Protected system prompt');
    list.add(message('input'), 'input');
    const limiter = new TokenLimiterProcessor({ limit: 0, trimMode: 'memory-only' });
    await expect(limiter.processInput(args(list))).resolves.toBe(list);
    expect(list.get.all.db().map(m => m.id)).toEqual(['input']);
    expect(list.getAllSystemMessages()).toHaveLength(1);
  });

  it('preserves non-streaming output in memory-only mode', async () => {
    const messages = [{ ...message('A response that exceeds the zero token budget'), role: 'assistant' as const }];
    const original = structuredClone(messages);
    const abort = vi.fn((reason?: string): never => {
      throw new Error(reason);
    });
    const limiter = new TokenLimiterProcessor({ limit: 0, trimMode: 'memory-only' });
    await expect(limiter.processOutputResult({ messages, abort })).resolves.toBe(messages);
    expect(messages).toEqual(original);
    expect(abort).not.toHaveBeenCalled();
  });

  it('keeps the boundary monotonic and accumulates removals at the same timestamp', () => {
    const first = advanceMemoryTokenBoundary(undefined, [message('first', 1)], 100, 25)!;
    expect(advanceMemoryTokenBoundary(first, [message('older')], 100, 25)).toBe(first);
    const second = advanceMemoryTokenBoundary(first, [message('second', 1)], 100, 25)!;
    expect(second.messageIds).toEqual(['first', 'second']);
  });

  it('merges boundary candidates within one normalized configuration epoch', () => {
    const older = advanceMemoryTokenBoundary(undefined, [message('older')], 100, 25)!;
    const newer = advanceMemoryTokenBoundary(undefined, [message('newer', 2)], 100, 25)!;
    const sameTime = advanceMemoryTokenBoundary(undefined, [message('same-time', 2)], 100, 25)!;

    expect(mergeMemoryTokenBoundaries(newer, older)).toBe(newer);
    expect(mergeMemoryTokenBoundaries(older, newer)).toBe(newer);
    expect(mergeMemoryTokenBoundaries(newer, sameTime)).toEqual({
      ...newer,
      messageIds: ['newer', 'same-time'],
    });
  });

  it('starts a separate boundary epoch when the normalized configuration changes', () => {
    const previous = advanceMemoryTokenBoundary(undefined, [message('newer', 2)], 100, 25)!;
    const nextEpoch = advanceMemoryTokenBoundary(undefined, [message('older')], 200, 50)!;

    expect(mergeMemoryTokenBoundaries(previous, nextEpoch)).toBe(nextEpoch);
    expect(advanceMemoryTokenBoundary(previous, [message('older')], 200, 50)).toEqual(nextEpoch);
  });

  it('keeps the base storage compatibility fallback observational', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        metadata: { unrelated: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const candidate = advanceMemoryTokenBoundary(undefined, [message('candidate', 1)], 100, 25)!;

    const result = await MemoryStorage.prototype.advanceMemoryTokenBoundary.call(store, {
      id: 'thread',
      resourceId: 'resource',
      candidate,
    });

    expect(result).toMatchObject({ supported: false, boundary: undefined });
    expect(result.thread?.metadata).toEqual({ unrelated: true });
    expect((await store.getThreadById({ threadId: 'thread' }))?.metadata).toEqual({ unrelated: true });
    await expect(
      MemoryStorage.prototype.advanceMemoryTokenBoundary.call(store, {
        id: 'missing',
        resourceId: 'resource',
        candidate,
      }),
    ).resolves.toEqual({ supported: false, thread: null, boundary: undefined });
    await expect(
      MemoryStorage.prototype.advanceMemoryTokenBoundary.call(store, {
        id: 'thread',
        resourceId: 'other-resource',
        candidate,
      }),
    ).resolves.toEqual({ supported: false, thread: null, boundary: undefined });
  });

  it('does not let supported boundary updates move an in-memory boundary backward', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const updateBoundary = (removed: MastraDBMessage[]) =>
      store.advanceMemoryTokenBoundary({
        id: 'thread',
        resourceId: 'resource',
        candidate: advanceMemoryTokenBoundary(undefined, removed, 100, 25)!,
      });

    const results = await Promise.all([updateBoundary([message('newer', 2)]), updateBoundary([message('older', 1)])]);

    expect(results.every(result => result.supported)).toBe(true);
    expect(getMemoryTokenBoundary(await store.getThreadById({ threadId: 'thread' }))?.createdAt).toBe(
      message('newer', 2).createdAt.toISOString(),
    );
  });

  it('loads token history through finite backwards pages', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    const storedMessages = Array.from({ length: 100 }, (_, index) => message(`message-${index}`, index));
    await store.saveMessages({ messages: storedMessages });
    const listMessages = vi.spyOn(store, 'listMessages');

    const result = await loadMessageHistory({
      storage: store,
      threadId: 'thread',
      resourceId: 'resource',
      maxTokens: 50,
      atMaxRemoveTokens: 0,
      tokenCounter: { countMessage: () => 10 },
      pageSize: 3,
    });

    expect(result.messages.map(item => item.id)).toEqual([
      'message-95',
      'message-96',
      'message-97',
      'message-98',
      'message-99',
    ]);
    expect(listMessages.mock.calls.length).toBeGreaterThan(1);
    expect(listMessages).not.toHaveBeenCalledWith(expect.objectContaining({ perPage: false }));
    expect(listMessages.mock.calls.every(([input]) => input.perPage === 3 && input.includeTotal === false)).toBe(true);
  });

  it('excludes count-only overflow when the count window fits the token target', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    const storedMessages = Array.from({ length: 4 }, (_, index) => message(`message-${index}`, index));
    await store.saveMessages({ messages: storedMessages });

    const result = await loadMessageHistory({
      storage: store,
      threadId: 'thread',
      resourceId: 'resource',
      maxMessages: 3,
      maxTokens: 240,
      atMaxRemoveTokens: 90,
      tokenCounter: { countMessage: () => 40 },
      includeOverflow: true,
    });

    expect(result.messages.map(item => item.id)).toEqual(['message-1', 'message-2', 'message-3']);
    expect(result.overflow).toEqual([]);
  });

  it('exposes token overflow from within the count window without exposing count overflow', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    const storedMessages = Array.from({ length: 4 }, (_, index) => message(`message-${index}`, index));
    await store.saveMessages({ messages: storedMessages });

    const result = await loadMessageHistory({
      storage: store,
      threadId: 'thread',
      resourceId: 'resource',
      maxMessages: 3,
      maxTokens: 100,
      atMaxRemoveTokens: 40,
      tokenCounter: { countMessage: () => 40 },
      includeOverflow: true,
    });

    expect(result.messages.map(item => item.id)).toEqual(['message-3']);
    expect(result.overflow.map(item => item.id)).toEqual(['message-1', 'message-2']);
    expect([...result.overflow, ...result.messages].map(item => item.id)).not.toContain('message-0');
  });

  it('loads every retained message across boundary-timestamp pages', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    const removed = message('removed');
    const retained = ['retained-a', 'retained-b', 'retained-c', 'retained-d', 'retained-e'].map(id => message(id));
    await store.saveMessages({ messages: [removed, ...retained] });

    const result = await loadMessageHistory({
      storage: store,
      threadId: 'thread',
      resourceId: 'resource',
      boundary: advanceMemoryTokenBoundary(undefined, [removed], 100, 25),
      maxMessages: 10,
      pageSize: 2,
    });

    expect(result.messages.map(item => item.id)).toEqual(retained.map(item => item.id));
  });

  it('does not split linked tool messages at a history limit', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    const toolMessage = (id: string, state: 'call' | 'result', seconds: number): MastraDBMessage => ({
      ...message(id, seconds),
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state,
              toolCallId: 'tool-call',
              toolName: 'lookup',
              args: {},
              ...(state === 'result' ? { result: 'done' } : {}),
            },
          },
        ],
      },
    });
    await store.saveMessages({ messages: [toolMessage('call', 'call', 0), toolMessage('result', 'result', 1)] });

    const result = await loadMessageHistory({
      storage: store,
      threadId: 'thread',
      resourceId: 'resource',
      maxMessages: 1,
      maxTokens: 100,
      atMaxRemoveTokens: 0,
      tokenCounter: { countMessage: () => 1 },
      includeOverflow: true,
      pageSize: 1,
    });

    expect(result.messages).toEqual([]);
    expect(result.overflow).toEqual([]);
  });

  it('keeps pagination bounded for a self-contained tool result', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    const resultMessage: MastraDBMessage = {
      ...message('completed-tool', 10),
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'completed-tool-call',
              toolName: 'lookup',
              args: {},
              result: 'done',
            },
          },
        ],
      },
    };
    await store.saveMessages({
      messages: [...Array.from({ length: 10 }, (_, index) => message(`ordinary-${index}`, index)), resultMessage],
    });
    const listMessages = vi.spyOn(store, 'listMessages');

    const result = await loadMessageHistory({
      storage: store,
      threadId: 'thread',
      resourceId: 'resource',
      maxMessages: 1,
      pageSize: 2,
    });

    expect(result.messages.map(item => item.id)).toEqual(['completed-tool']);
    expect(listMessages).toHaveBeenCalledTimes(2);
  });

  it('persists full-prompt trimming from token overflow inside the explicit count window', async () => {
    class FixedTokenMockMemory extends MockMemory {
      protected override createMemoryTokenCounter() {
        return { countMessage: () => 40 };
      }
    }

    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    const thread = await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await store.saveMessages({
      messages: [message('count-overflow', 0), message('token-overflow', 1), message('trimmed', 2), message('kept', 3)],
    });
    const context = new RequestContext();
    context.set('MastraMemory', { thread, resourceId: 'resource' });
    const memory = new FixedTokenMockMemory({
      storage,
      options: { lastMessages: 3, messageHistory: { maxTokens: 150, atMaxRemoveTokens: 40 } },
    });
    const processors = await memory.getInputProcessors([], context);
    const history = processors.find(p => p.id === 'message-history')!;
    const limiter = processors.find(p => p.id === 'memory-token-limiter')!;
    const list = new MessageList();

    await history.processInput!(args(list, context));
    expect(list.get.all.db().map(item => item.id)).toEqual(['token-overflow', 'trimmed', 'kept']);
    list.add(message('input', 4), 'input');
    await limiter.processInput!(args(list, context));

    expect(list.get.all.db().map(item => item.id)).toEqual(['kept', 'input']);
    const saved = (await store.getThreadById({ threadId: 'thread' }))!;
    expect(getMemoryTokenBoundary(saved)).toMatchObject({
      createdAt: message('trimmed', 2).createdAt.toISOString(),
      messageIds: ['trimmed'],
      maxTokens: 150,
      atMaxRemoveTokens: 40,
    });

    context.set('MastraMemory', { thread: saved, resourceId: 'resource' });
    const next = new MessageList();
    await history.processInput!(args(next, context));
    expect(next.get.all.db().map(item => item.id)).toEqual(['kept']);
    expect((await store.listMessages({ threadId: 'thread', perPage: false })).messages).toHaveLength(4);
  });

  it('does not install a trim candidate when storage reports persistence unsupported', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    const thread = await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        metadata: { unrelated: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.spyOn(store, 'advanceMemoryTokenBoundary').mockImplementation(input =>
      MemoryStorage.prototype.advanceMemoryTokenBoundary.call(store, input),
    );
    const context = new RequestContext();
    context.set('MastraMemory', { thread, resourceId: 'resource' });
    const memory = new MockMemory({ storage, options: { messageHistory: { maxTokens: 32, atMaxRemoveTokens: 0 } } });
    const limiter = (await memory.getInputProcessors([], context)).find(p => p.id === 'memory-token-limiter')!;
    const list = new MessageList();
    list.add([message('old'), message('newer', 1)], 'memory');
    list.add(message('input', 2), 'input');

    await limiter.processInput!(args(list, context));

    expect(store.advanceMemoryTokenBoundary).toHaveBeenCalledOnce();
    expect(thread.metadata).toEqual({ unrelated: true });
    expect(getMemoryTokenBoundary(await store.getThreadById({ threadId: 'thread' }))).toBeUndefined();
  });

  it('does not crash when an asymmetric storage package lacks the new operation', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    const thread = await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    Object.defineProperty(store, 'advanceMemoryTokenBoundary', { value: undefined, configurable: true });
    const context = new RequestContext();
    context.set('MastraMemory', { thread, resourceId: 'resource' });
    const memory = new MockMemory({ storage, options: { messageHistory: { maxTokens: 32, atMaxRemoveTokens: 0 } } });
    const limiter = (await memory.getInputProcessors([], context)).find(p => p.id === 'memory-token-limiter')!;
    const list = new MessageList();
    list.add([message('old'), message('newer', 1)], 'memory');
    list.add(message('input', 2), 'input');

    await expect(limiter.processInput!(args(list, context))).resolves.toBe(list);
    expect(getMemoryTokenBoundary(await store.getThreadById({ threadId: 'thread' }))).toBeUndefined();
  });

  it('persists trimming through real storage and does not reintroduce removed history next turn', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    const thread = await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        title: 'Keep title',
        metadata: { unrelated: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await store.saveMessages({ messages: [message('old'), message('same-time'), message('newer', 1)] });
    const context = new RequestContext();
    context.set('MastraMemory', { thread, resourceId: 'resource' });
    const memory = new MockMemory({ storage, options: { messageHistory: { maxTokens: 32, atMaxRemoveTokens: 0 } } });
    const processors = await memory.getInputProcessors([], context);
    const history = processors.find(p => p.id === 'message-history')!;
    const limiter = processors.find(p => p.id === 'memory-token-limiter')!;
    const list = new MessageList();
    await history.processInput!(args(list, context));
    expect(list.get.all.db()).toHaveLength(3);
    await limiter.processInput!(args(list, context));
    const saved = (await store.getThreadById({ threadId: 'thread' }))!;
    expect(saved.title).toBe('Keep title');
    expect(saved.metadata?.unrelated).toBe(true);
    expect(getMemoryTokenBoundary(saved)).toBeDefined();
    context.set('MastraMemory', { thread: saved, resourceId: 'resource' });
    const next = new MessageList();
    await history.processInput!(args(next, context));
    expect(next.get.all.db().map(m => m.id)).toEqual(list.get.all.db().map(m => m.id));
    // Trimming changes context, not stored chat history.
    expect((await store.listMessages({ threadId: 'thread', perPage: false })).messages).toHaveLength(3);
  });

  it('checks readOnly when the trim callback executes', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    const thread = await store.saveThread({
      thread: {
        id: 'thread',
        resourceId: 'resource',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const context = new RequestContext();
    context.set('MastraMemory', { thread, resourceId: 'resource' });
    const memory = new MockMemory({ storage, options: { messageHistory: { maxTokens: 32, atMaxRemoveTokens: 0 } } });
    const limiter = (await memory.getInputProcessors([], context)).find(p => p.id === 'memory-token-limiter')!;
    context.set('MastraMemory', {
      thread,
      resourceId: 'resource',
      memoryConfig: { readOnly: true, messageHistory: { maxTokens: 32, atMaxRemoveTokens: 0 } },
    });
    const list = new MessageList();
    list.add([message('old'), message('newer', 1)], 'memory');
    list.add(message('input', 2), 'input');

    await limiter.processInput!(args(list, context));

    expect(getMemoryTokenBoundary(await store.getThreadById({ threadId: 'thread' }))).toBeUndefined();
  });

  it('retains unremoved messages at the boundary timestamp', async () => {
    const store = (await new InMemoryStore().getStore('memory'))!;
    await store.saveMessages({ messages: [message('removed'), message('retained'), message('newer', 1)] });
    const context = new RequestContext();
    context.set('MastraMemory', {
      thread: {
        id: 'thread',
        metadata: {
          memoryTokenLimiter: advanceMemoryTokenBoundary(undefined, [message('removed')], 100, 25),
        },
      },
      resourceId: 'resource',
    });
    const history = new MessageHistory({
      storage: store,
      lastMessages: false,
      tokenLimit: { maxTokens: 100, atMaxRemoveTokens: 25 },
      tokenCounter: { countMessage: () => 1 },
    });
    const list = new MessageList();
    await history.processInput(args(list, context));
    expect(list.get.all.db().map(m => m.id)).toEqual(['retained', 'newer']);
  });
});
