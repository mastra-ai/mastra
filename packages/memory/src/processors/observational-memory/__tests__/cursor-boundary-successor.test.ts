import { MessageList } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterObservedMessages } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';

// MessageList spaces messages added in the same millisecond 1ms apart, so the message after a
// buffered chunk can sit exactly 1ms past the chunk's newest message.
describe('message 1ms after an async-buffered chunk', () => {
  afterEach(() => vi.restoreAllMocks());

  it('survives activation and reaches the next Observer call', async () => {
    const threadId = 'cursor-boundary';
    const resourceId = 'cursor-boundary-resource';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
    });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: 'openai/gpt-4o-mini', messageTokens: 10_000, bufferTokens: 2_000, blockAfter: 1.2 },
      reflection: { model: 'openai/gpt-4o-mini', observationTokens: 50_000 },
    });

    const t0 = Date.now() - 60_000;
    const msg = (id: string, role: 'user' | 'assistant', at: number) => ({
      id,
      role,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: `${id} ${'data '.repeat(300)}` }] },
      type: 'text' as const,
      createdAt: new Date(at),
      threadId,
      resourceId,
    });
    const observed = msg('observed', 'assistant', t0);
    const successor = msg('successor', 'user', t0 + 1);
    await storage.saveMessages({ messages: [observed, successor] });

    const seen: string[][] = [];
    vi.spyOn(om.observer, 'call').mockImplementation(async (...args: unknown[]) => {
      const messages = args.find(a => Array.isArray(a)) as { id: string }[] | undefined;
      seen.push((messages ?? []).map(m => m.id));
      return {
        observations: `- observation ${seen.length}`,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      } as Awaited<ReturnType<typeof om.observer.call>>;
    });

    await om.buffer({ threadId, resourceId, messages: [observed], skipMinimumTokenCheck: true });
    const activation = await om.activate({ threadId, resourceId });
    expect(activation.activated).toBe(true);

    // Context pruning after activation keeps the successor.
    const list = new MessageList({ threadId, resourceId });
    list.add([observed, successor], 'memory');
    filterObservedMessages({ messageList: list, record: activation.record });
    expect(list.get.all.db().map(m => m.id)).toEqual(['successor']);

    // The next storage-loaded buffer still selects it for the Observer.
    await om.buffer({ threadId, resourceId, skipMinimumTokenCheck: true });
    expect(seen.at(-1)).toEqual(['successor']);
  });
});
