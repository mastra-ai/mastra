import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { getMemoryTokenBoundary } from '@mastra/core/memory';
import type { ProcessInputArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { TokenCounter } from '@mastra/memory/processors';
import { afterEach, describe, expect, it } from 'vitest';

const turn = (i: number): MastraDBMessage => ({
  id: `m${String(i).padStart(3, '0')}`,
  role: i % 2 ? 'assistant' : 'user',
  threadId: 'thread',
  resourceId: 'resource',
  createdAt: new Date(1_700_000_000_000 + i * 1000),
  content: { format: 2, parts: [{ type: 'text', text: `message ${i} `.repeat(20) }] },
});

describe('messageHistory token budget with LibSQL (#31469)', () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('keeps the history start stable across runs when the newest page is between the trim target and maxTokens', async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-31469-'));
    const storage = new LibSQLStore({ id: 'history-31469', url: `file:${join(dir, 'history.db')}` });
    const weight = new TokenCounter().countMessage(turn(0));
    const memory = new Memory({
      storage,
      options: { messageHistory: { maxTokens: weight * 50, atMaxRemoveTokens: weight * 30 } },
    });
    let thread = await memory.saveThread({
      thread: { id: 'thread', resourceId: 'resource', title: 'history', createdAt: new Date(), updatedAt: new Date() },
    });
    const store = (await storage.getStore('memory'))!;
    await store.saveMessages({ messages: Array.from({ length: 100 }, (_, i) => turn(i)) });

    const oldest: string[] = [];
    for (let run = 0; run < 3; run++) {
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', { thread, resourceId: 'resource' });
      const messageList = new MessageList();
      for (const processor of await memory.getInputProcessors([], requestContext)) {
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
      oldest.push(messageList.get.all.db()[0]!.id);
      thread = (await memory.getThreadById({ threadId: 'thread' }))!;
      await store.saveMessages({ messages: [turn(100 + run * 2), turn(101 + run * 2)] });
    }

    expect(oldest).toEqual([oldest[0], oldest[0], oldest[0]]);
    expect(getMemoryTokenBoundary(thread)).toBeDefined();
  });
});
