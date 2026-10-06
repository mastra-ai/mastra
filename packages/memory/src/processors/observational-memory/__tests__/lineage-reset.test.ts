/**
 * A cycle that started before its record was cleared must not commit into the record created
 * afterwards. Clearing (`om.clear`, `Memory.deleteThread`) deletes every generation of the
 * thread/resource; if the thread is used again, a new, unrelated record takes its place. The
 * cycle's observations come from the cleared messages, so committing them there would bring
 * deleted content back.
 */
import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

const DELETED_FACT = 'DELETED_PRIVATE_FACT_41c2';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('a cycle that spans a clear', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const scope of ['thread', 'resource'] as const) {
    for (const operation of ['buffer', 'observe'] as const) {
      if (scope === 'resource' && operation === 'buffer') continue;
      for (const generation of [0, 1]) {
        it(`${scope} ${operation} started on generation ${generation} does not commit into the recreated record`, async () => {
          const storage = new InMemoryMemory({ db: new InMemoryDB() });
          const threadId = randomUUID();
          const resourceId = randomUUID();
          const t0 = new Date(Date.now() - 60_000);
          await storage.saveThread({
            thread: { id: threadId, resourceId, title: 'old', createdAt: t0, updatedAt: t0 },
          });
          const om = new ObservationalMemory({
            storage,
            scope,
            observation: {
              model: 'openai/gpt-4o-mini',
              messageTokens: 1000,
              bufferTokens: scope === 'thread' ? 200 : false,
            },
            reflection: { model: 'openai/gpt-4o-mini', observationTokens: 2000 },
          });

          const initial = await om.getOrCreateRecord(threadId, resourceId);
          await storage.updateActiveObservations({
            id: initial.id,
            observations: 'OLD_CONTEXT',
            tokenCount: 10,
            lastObservedAt: t0,
          });
          if (generation === 1) {
            await storage.createReflectionGeneration({
              currentRecord: structuredClone(await storage.getObservationalMemory(initial.threadId, resourceId))!,
              reflection: 'OLD_REFLECTED_CONTEXT',
              tokenCount: 10,
            });
          }
          const origin = (await storage.getObservationalMemory(initial.threadId, resourceId))!;
          expect(origin.generationCount).toBe(generation);

          const entered = deferred();
          const gate = deferred();
          vi.spyOn(om.observer, 'call').mockImplementation(async () => {
            entered.resolve();
            await gate.promise;
            return { observations: DELETED_FACT } as any;
          });
          vi.spyOn(om.observer, 'callMultiThread').mockImplementation(async () => {
            entered.resolve();
            await gate.promise;
            return { results: new Map([[threadId, { observations: DELETED_FACT }]]) } as any;
          });

          const messages: MastraDBMessage[] = [
            {
              id: `msg-${randomUUID()}`,
              role: 'user',
              type: 'text',
              threadId,
              resourceId,
              createdAt: new Date(t0.getTime() + 1000),
              content: { format: 2, parts: [{ type: 'text', text: `${DELETED_FACT} ${'words '.repeat(1500)}` }] },
            },
          ];
          await storage.saveMessages({ messages });
          const opts = { threadId, resourceId, record: origin, messages };
          const running = (operation === 'buffer' ? om.buffer(opts) : om.observe(opts)).catch(error => ({
            error: String(error),
          }));
          await entered.promise;

          await om.clear(threadId, resourceId);
          await storage.deleteThread({ threadId });
          await storage.saveThread({
            thread: { id: threadId, resourceId, title: 'new', createdAt: new Date(), updatedAt: new Date() },
          });
          const recreated = await om.getOrCreateRecord(threadId, resourceId);

          gate.resolve();
          await running;

          const head = (await storage.getObservationalMemory(recreated.threadId, resourceId))!;
          expect(head.id).toBe(recreated.id);
          expect(head.bufferedObservationChunks ?? []).toHaveLength(0);
          expect(head.activeObservations).toBe('');
          expect(JSON.stringify(head)).not.toContain(DELETED_FACT);
          // Generation ids are never reused, so a write addressed to a cleared record can't land.
          expect(recreated.id).not.toBe(origin.id);
          expect(recreated.id).not.toBe(initial.id);
        });
      }
    }
  }
});
