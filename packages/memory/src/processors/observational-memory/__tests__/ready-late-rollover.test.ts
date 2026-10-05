import { randomUUID } from 'node:crypto';

import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

/**
 * A ready buffered chunk and a late chunk whose Observer call is still running when a reflection
 * rolls the record over. The rollover comes either from step 0 activating a buffered reflection,
 * or from another writer (another process: straight to storage, outside this process's commit
 * queue) while the late op is held. The late chunk lands after the rollover. Both facts must reach
 * the head generation, and the head cursor must never pass a message whose observation is not on
 * the head.
 */
const priorFact = '- reflected prior observations';
const readyFact = '- ready fact retained from earlier buffering';
const lateFact = '- late fact from held observer';

describe('ready and late chunks across a rollover', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const rollover of ['step-0', 'other-writer'] as const) {
    for (const hasReadyChunk of [false, true]) {
      it(`keeps every observation on the head (rollover: ${rollover}, ready chunk: ${hasReadyChunk})`, async () => {
        const threadId = `ready-late-${rollover}-${hasReadyChunk}`;
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
        // Without a ready chunk, `old` is already observed (behind the cursor, in the prior text),
        // so the buffered list still starts right after the cursor.
        await storage.updateActiveObservations({
          id: initial.id,
          observations: '- prior observations',
          tokenCount: 50_000,
          lastObservedAt: new Date(hasReadyChunk ? t0 - 1000 : old.createdAt.getTime()),
        });
        await storage.updateBufferedReflection({
          id: initial.id,
          reflection: priorFact,
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

        try {
          if (rollover === 'other-writer') {
            // Another process reflects while the late op is held; the ready chunk is still buffered.
            const stored = (await storage.getObservationalMemory(threadId, resourceId))!;
            const newRecordId = randomUUID();
            const head = await storage.swapBufferedReflectionToActive({
              currentRecord: stored,
              tokenCount: 10,
              newRecordId,
            });
            expect(head.id).toBe(newRecordId);
            release();
            await bufferOp;
            const turn = om.beginTurn({ threadId, resourceId, messageList });
            await turn.start();
            await turn.step(0).prepare();
            await turn.step(1).prepare();
          } else {
            // Release the held write as soon as step 0's reflection has rolled the record over,
            // so it lands after the rollover.
            const swapReflection = storage.swapBufferedReflectionToActive.bind(storage);
            vi.spyOn(storage, 'swapBufferedReflectionToActive').mockImplementation(async input => {
              const result = await swapReflection(input);
              release();
              return result;
            });
            const turn = om.beginTurn({ threadId, resourceId, messageList });
            await turn.start();
            await turn.step(0).prepare();
            await bufferOp;
            await om.settled();
            await turn.step(1).prepare();
          }
        } finally {
          release();
          await bufferOp;
          await om.settled();
        }

        const head = (await storage.getObservationalMemory(threadId, resourceId))!;
        expect(head.id).not.toBe(initial.id);
        expect(head.activeObservations).toContain(priorFact);
        expect(head.activeObservations).toContain(lateFact);
        if (hasReadyChunk) expect(head.activeObservations).toContain(readyFact);
        const retired = (await storage.getObservationalMemoryHistory(threadId, resourceId)).find(
          r => r.id === initial.id,
        );
        expect(retired?.bufferedObservationChunks ?? []).toEqual([]);

        // The cursor passes both messages, and each one's observation is on the head.
        const factFor: Record<string, string> = { old: hasReadyChunk ? readyFact : priorFact, late: lateFact };
        const cursor = head.lastObservedAt!.getTime();
        for (const message of [old, late]) {
          expect(cursor).toBeGreaterThanOrEqual(message.createdAt.getTime());
          expect(head.activeObservations).toContain(factFor[message.id]);
        }
      });
    }
  }
});
