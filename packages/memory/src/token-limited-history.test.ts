import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
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

describe('nested lastMessages', () => {
  it('normalizes pagination without imposing the default message count on token-only history', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({ storage, options: { lastMessages: { maxTokens: 1000 } } });
    await memory.saveThread({
      thread: { id: 'thread', resourceId: 'resource', createdAt: new Date(), updatedAt: new Date() },
    });
    await (await storage.getStore('memory'))!.saveMessages({ messages });
    const recalled = await memory.recall({ threadId: 'thread', resourceId: 'resource' });
    expect(recalled.messages).toHaveLength(15);
    expect(
      (
        await memory.recall({
          threadId: 'thread',
          resourceId: 'resource',
          threadConfig: { lastMessages: { maxMessages: 3 } },
        })
      ).messages.map(m => m.id),
    ).toEqual(['message-12', 'message-13', 'message-14']);
    expect(
      (
        await memory.recall({
          threadId: 'thread',
          resourceId: 'resource',
          threadConfig: { lastMessages: { maxMessages: 0 } },
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

  it('uses the observational-memory counter in the automatically injected limiter', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({ storage, options: { lastMessages: { maxTokens: 500, atMaxRemoveTokens: 100 } } });
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
