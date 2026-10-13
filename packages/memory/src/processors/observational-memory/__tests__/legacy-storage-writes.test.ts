/**
 * `@mastra/memory` supports `@mastra/core` versions whose storage only has the void-returning
 * `updateActiveObservations` / `updateBufferedObservations`. Without `commitActiveObservations`
 * and `appendBufferedObservations`, observations and buffered chunks are still written, through
 * the older methods.
 */
import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

const FACT = 'LEGACY_STORAGE_FACT_7d1e';

/** Storage shaped like a core release that predates the result-returning methods. */
function legacyStorage() {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  const commit = storage.commitActiveObservations.bind(storage);
  const append = storage.appendBufferedObservations.bind(storage);
  Object.assign(storage, {
    updateActiveObservations: async (input: Parameters<typeof commit>[0]) => {
      await commit(input);
    },
    updateBufferedObservations: async (input: Parameters<typeof append>[0]) => {
      await append(input);
    },
    commitActiveObservations: undefined,
    appendBufferedObservations: undefined,
  });
  return storage;
}

describe('storage without commitActiveObservations / appendBufferedObservations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const operation of ['observe', 'buffer'] as const) {
    it(`${operation} writes through the void-returning method`, async () => {
      const storage = legacyStorage();
      const threadId = randomUUID();
      const resourceId = randomUUID();
      const t0 = new Date(Date.now() - 60_000);
      await storage.saveThread({ thread: { id: threadId, resourceId, title: 't', createdAt: t0, updatedAt: t0 } });
      const om = new ObservationalMemory({
        storage,
        scope: 'thread',
        observation: { model: 'openai/gpt-4o-mini', messageTokens: 1000, bufferTokens: 200 },
        reflection: { model: 'openai/gpt-4o-mini', observationTokens: 20_000 },
      });
      vi.spyOn(om.observer, 'call').mockResolvedValue({ observations: `- ${FACT}` } as any);
      const updateActive = vi.spyOn(storage, 'updateActiveObservations');
      const updateBuffered = vi.spyOn(storage, 'updateBufferedObservations');

      const record = await om.getOrCreateRecord(threadId, resourceId);
      const messages: MastraDBMessage[] = [
        {
          id: `msg-${randomUUID()}`,
          role: 'user',
          type: 'text',
          threadId,
          resourceId,
          createdAt: new Date(t0.getTime() + 1000),
          content: { format: 2, parts: [{ type: 'text', text: `${FACT} ${'words '.repeat(1500)}` }] },
        },
      ];
      await storage.saveMessages({ messages });
      const opts = { threadId, resourceId, record, messages };

      const head = async () => (await storage.getObservationalMemory(threadId, resourceId))!;
      if (operation === 'observe') {
        expect(await om.observe(opts)).toMatchObject({ observed: true });
        expect(updateActive).toHaveBeenCalledTimes(1);
        expect((await head()).activeObservations).toContain(FACT);
      } else {
        expect(await om.buffer(opts)).toMatchObject({ buffered: true });
        expect(updateBuffered).toHaveBeenCalledTimes(1);
        expect((await head()).bufferedObservationChunks?.map(chunk => chunk.observations).join('\n')).toContain(FACT);
      }
    });
  }
});
