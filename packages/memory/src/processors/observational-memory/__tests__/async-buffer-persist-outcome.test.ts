/**
 * Async buffering's `persist()` reports what happened: `committed` (with the head record the
 * chunk landed on) when the chunk landed, `not-committed` when it didn't, and `undefined` only
 * when there was nothing to persist. Callers that act on a landed observation must be able to
 * tell a committed chunk from a skipped cycle.
 */
import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsyncBufferObservationStrategy } from '../observation-strategies/async-buffer';
import { ObservationalMemory } from '../observational-memory';

async function bufferOnce(observations: string, opts: { rolloverBeforeAppend?: boolean } = {}) {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  const threadId = randomUUID();
  const resourceId = randomUUID();
  const t0 = new Date(Date.now() - 60_000);
  await storage.saveThread({ thread: { id: threadId, resourceId, title: 'thread', createdAt: t0, updatedAt: t0 } });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini', messageTokens: 1000, bufferTokens: 200 },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 2000 },
  });
  const record = await om.getOrCreateRecord(threadId, resourceId);
  vi.spyOn(om.observer, 'call').mockResolvedValue({ observations } as any);

  if (opts.rolloverBeforeAppend) {
    // Another writer rolls the generation over after the cycle read its head, before the append.
    const append = storage.updateBufferedObservations.bind(storage);
    let rolled = false;
    vi.spyOn(storage, 'updateBufferedObservations').mockImplementation(async input => {
      if (!rolled) {
        rolled = true;
        await storage.createReflectionGeneration({
          currentRecord: structuredClone((await storage.getObservationalMemory(threadId, resourceId))!),
          reflection: 'REFLECTED',
          tokenCount: 1,
        });
      }
      return append(input);
    });
  }

  const persist = AsyncBufferObservationStrategy.prototype.persist;
  const outcomes: unknown[] = [];
  vi.spyOn(AsyncBufferObservationStrategy.prototype, 'persist').mockImplementation(async function (this: any, p) {
    const outcome = await persist.call(this, p);
    outcomes.push(outcome);
    return outcome;
  });

  const messages: MastraDBMessage[] = [
    {
      id: `msg-${randomUUID()}`,
      role: 'user',
      type: 'text',
      threadId,
      resourceId,
      createdAt: new Date(t0.getTime() + 1000),
      content: { format: 2, parts: [{ type: 'text', text: `FACT ${'words '.repeat(400)}` }] },
    },
  ];
  await storage.saveMessages({ messages });
  await om.buffer({ threadId, resourceId, record, messages });

  const head = (await storage.getObservationalMemory(threadId, resourceId))!;
  return { outcomes, head, initialId: record.id };
}

describe('async buffer persist outcome', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a landed chunk as committed on the head record', async () => {
    const { outcomes, head } = await bufferOnce('- 🔴 BUFFERED_FACT_7f3a');

    expect(head.bufferedObservationChunks?.map(c => c.observations)).toEqual(['- 🔴 BUFFERED_FACT_7f3a']);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      status: 'committed',
      processed: { observations: '- 🔴 BUFFERED_FACT_7f3a' },
      record: { id: head.id },
    });
  });

  it('reports the generation the append was redirected to after a rollover', async () => {
    const { outcomes, head, initialId } = await bufferOnce('- 🔴 BUFFERED_FACT_9c1d', { rolloverBeforeAppend: true });

    expect(head.id).not.toBe(initialId);
    expect(head.bufferedObservationChunks?.map(c => c.observations)).toEqual(['- 🔴 BUFFERED_FACT_9c1d']);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ status: 'committed', record: { id: head.id } });
  });

  it('returns nothing when there is nothing to persist', async () => {
    const { outcomes, head } = await bufferOnce('');

    expect(head.bufferedObservationChunks ?? []).toHaveLength(0);
    expect(outcomes).toEqual([undefined]);
  });
});
