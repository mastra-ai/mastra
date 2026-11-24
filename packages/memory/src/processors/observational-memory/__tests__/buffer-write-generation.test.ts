import { MessageList } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

describe('in-flight observation buffer vs reflection rollover', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the chunk to the generation reflection created while the Observer ran', async () => {
    const threadId = 'buffer-write-generation';
    const resourceId = 'buffer-write-generation-resource';
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
    const msg = (id: string, role: 'user' | 'assistant', repeats: number, at: number) => ({
      id,
      role,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'data '.repeat(repeats) }] },
      type: 'text' as const,
      createdAt: new Date(at),
      threadId,
      resourceId,
    });
    const old = msg('old', 'assistant', 600, t0);
    const late = msg('late', 'assistant', 300, t0 + 1000);
    const prompt = msg('prompt', 'user', 11_000, Date.now());
    await storage.saveMessages({ messages: [old, late] });

    // Observations are at the reflection threshold with a ready buffered reflection,
    // so step 0 activates it and starts generation 1.
    const initial = await om.getOrCreateRecord(threadId, resourceId);
    await storage.updateActiveObservations({
      id: initial.id,
      observations: '- prior observations',
      tokenCount: 50_000,
      lastObservedAt: new Date(t0 - 1000),
    });
    await storage.updateBufferedReflection({
      id: initial.id,
      reflection: '- reflected prior observations',
      tokenCount: 10,
      inputTokenCount: 50_000,
      reflectedObservationLineCount: 1,
    });

    // Hold the Observer so the buffer op is mid-flight when step 0 reflects.
    let releaseObserver!: () => void;
    let observerEntered!: () => void;
    const observerGate = new Promise<void>(resolve => (releaseObserver = resolve));
    const observerStarted = new Promise<void>(resolve => (observerEntered = resolve));
    vi.spyOn(om.observer, 'call').mockImplementation(async () => {
      observerEntered();
      await observerGate;
      return {
        observations: '- late observation',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      } as Awaited<ReturnType<typeof om.observer.call>>;
    });
    const bufferOp = om.buffer({ threadId, resourceId, messages: [late], skipMinimumTokenCheck: true });
    await observerStarted;

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([old, late], 'memory');
    messageList.add(prompt, 'input');
    const status = await om.getStatus({ threadId, resourceId, messages: messageList.get.all.db() });
    expect(status.inAsyncObservationBand).toBe(true);

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    try {
      await turn.step(0).prepare();
      const afterReflection = await storage.getObservationalMemory(threadId, resourceId);
      expect(afterReflection?.id).not.toBe(initial.id);
      expect(afterReflection?.generationCount).toBe(1);
    } finally {
      releaseObserver();
      await bufferOp;
    }

    const head = (await storage.getObservationalMemory(threadId, resourceId))!;
    const history = await storage.getObservationalMemoryHistory(threadId, resourceId);
    const retired = history.find(r => r.id === initial.id)!;
    expect(head.bufferedObservationChunks?.map(c => c.observations)).toEqual(['- late observation']);
    expect(head.lastBufferedAtTime?.getTime()).toBeGreaterThan(late.createdAt.getTime());
    expect((retired.bufferedObservationChunks ?? []).map(c => c.observations)).not.toContain('- late observation');

    // The chunk is now activatable on the current generation.
    const activation = await om.activate({ threadId, resourceId });
    expect(activation.activated).toBe(true);
    expect(activation.record.id).toBe(head.id);
    expect(activation.record.activeObservations).toContain('- late observation');
    expect(activation.activatedMessageIds).toEqual([late.id]);

    await om.settled();
  });
});
