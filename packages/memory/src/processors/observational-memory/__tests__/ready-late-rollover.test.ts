import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

/**
 * A ready buffered chunk and a late chunk whose Observer call is still running when step 0
 * activates a buffered reflection (the threshold→blockAfter band defers observation activation
 * at step 0 while the late write is in flight). Both facts must reach the head generation, and
 * the head cursor must never pass a message whose observation is not on the head.
 */
const readyFact = '- ready fact retained from earlier buffering';
const lateFact = '- late fact from held observer';

describe('ready and late chunks across a step-0 rollover', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const hasReadyChunk of [false, true]) {
    it(`keeps every observation on the head (ready chunk: ${hasReadyChunk})`, async () => {
      const threadId = `ready-late-${hasReadyChunk}`;
      const resourceId = 'ready-late-resource';
      const storage = new InMemoryMemory({ db: new InMemoryDB() });
      await storage.saveThread({
        thread: { id: threadId, resourceId, title: 'ready-late', createdAt: new Date(), updatedAt: new Date() },
      });
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        observation: { model: 'openai/gpt-4o-mini', messageTokens: 10_000, bufferTokens: 2_000, blockAfter: 1.2 },
        reflection: { model: 'openai/gpt-4o-mini', observationTokens: 50_000 },
      });
      const t0 = Date.now() - 60_000;
      const msg = (id: string, role: 'user' | 'assistant', repeats: number, at: number): MastraDBMessage => ({
        id,
        role,
        content: { format: 2, parts: [{ type: 'text', text: 'data '.repeat(repeats) }] },
        type: 'text',
        createdAt: new Date(at),
        threadId,
        resourceId,
      });
      const old = msg('old', 'assistant', 600, t0);
      const late = msg('late', 'assistant', 300, t0 + 1000);
      const prompt = msg('prompt', 'user', 11_000, Date.now());
      await storage.saveMessages({ messages: [old, late] });
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
      if (hasReadyChunk) {
        await storage.updateBufferedObservations({
          id: initial.id,
          chunk: {
            cycleId: 'ready',
            observations: readyFact,
            tokenCount: 10,
            messageIds: [old.id],
            messageTokens: 600,
            lastObservedAt: new Date(old.createdAt.getTime() + 1),
          },
        });
      }

      let release!: () => void;
      let entered!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const started = new Promise<void>(resolve => (entered = resolve));
      vi.spyOn(om.observer, 'call').mockImplementation(async () => {
        entered();
        await gate;
        return {
          observations: lateFact,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        } as Awaited<ReturnType<typeof om.observer.call>>;
      });

      const bufferOp = om.buffer({ threadId, resourceId, messages: [late], skipMinimumTokenCheck: true });
      await started;
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add([old, late], 'memory');
      messageList.add(prompt, 'input');
      const status = await om.getStatus({ threadId, resourceId, messages: messageList.get.all.db() });
      expect(status.inAsyncObservationBand).toBe(true);

      const turn = om.beginTurn({ threadId, resourceId, messageList });
      await turn.start();
      // Release the held write while step 0 runs, so it lands after the reflection rollover.
      const timer = setTimeout(release, 250);
      try {
        await turn.step(0).prepare();
      } finally {
        clearTimeout(timer);
        release();
        await bufferOp;
        await om.settled();
      }
      await turn.step(1).prepare();
      await om.settled();

      const head = (await storage.getObservationalMemory(threadId, resourceId))!;
      expect(head.id).not.toBe(initial.id);
      expect(head.activeObservations).toContain('- reflected prior observations');
      expect(head.activeObservations).toContain(lateFact);
      const retired = (await storage.getObservationalMemoryHistory(threadId, resourceId)).find(
        r => r.id === initial.id,
      );
      expect(retired?.bufferedObservationChunks ?? []).toEqual([]);

      // The cursor must not pass a message whose fact is missing from the head. Without a ready
      // chunk, `old` was never sent to the Observer (buffer() above takes only `late`), so only the
      // ready-chunk case maps it to a fact.
      const factFor: Record<string, string> = { late: lateFact, ...(hasReadyChunk ? { old: readyFact } : {}) };
      const cursor = head.lastObservedAt!.getTime();
      for (const message of [old, late]) {
        if (message.createdAt.getTime() > cursor || !factFor[message.id]) continue;
        expect(head.activeObservations).toContain(factFor[message.id]);
      }
      if (hasReadyChunk) expect(cursor).toBeGreaterThanOrEqual(old.createdAt.getTime());
    });
  }
});
