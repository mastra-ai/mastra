import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import type { ProcessInputArgs } from '../processors';
import { MessageHistory } from '../processors/memory/message-history';
import { TokenLimiterProcessor } from '../processors/processors/token-limiter';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';
import {
  advanceMemoryTokenBoundary,
  getMemoryTokenBoundary,
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
  it('resolves lastMessages and messageTokens into one history config', () => {
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
    for (const tokens of [
      { maxTokens: NaN },
      { maxTokens: Infinity },
      { maxTokens: -1 },
      { maxTokens: 5, atMaxRemoveTokens: 6 },
      { maxTokens: 5, atMaxRemoveTokens: -1 },
    ]) {
      expect(() => normalizeMessageHistoryConfig(undefined, tokens)).toThrow('messageTokens');
    }
  });

  it.each([-1, 1.5, NaN, Infinity])('rejects invalid scalar message limit %s', value => {
    expect(() => normalizeMessageHistoryConfig(value)).toThrow('finite non-negative integer');
  });

  it('preserves disabled and unspecified scalar limits', () => {
    expect(normalizeMessageHistoryConfig(0)).toEqual({ enabled: false, maxMessages: 0 });
    expect(normalizeMessageHistoryConfig(undefined)).toEqual({ enabled: false, maxMessages: undefined });
  });

  it('drops the default count window when only messageTokens is configured', async () => {
    const withTokens = new MockMemory({ options: { messageTokens: { maxTokens: 100 } } });
    expect((withTokens as any).threadConfig.lastMessages).toBeUndefined();
    const withBoth = new MockMemory({ options: { lastMessages: 4, messageTokens: { maxTokens: 100 } } });
    expect((withBoth as any).threadConfig.lastMessages).toBe(4);
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
    const memory = new MockMemory({ storage, options: { messageTokens: { maxTokens: 32, atMaxRemoveTokens: 0 } } });
    const processors = await memory.getInputProcessors([], context);
    const history = processors.find(p => p.id === 'message-history')!;
    const limiter = processors.find(p => p.id === 'token-limiter')!;
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
    });
    const list = new MessageList();
    await history.processInput(args(list, context));
    expect(list.get.all.db().map(m => m.id)).toEqual(['retained', 'newer']);
  });
});
