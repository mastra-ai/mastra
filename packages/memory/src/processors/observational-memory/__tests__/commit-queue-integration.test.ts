/**
 * The process-wide commit queue with real ObservationalMemory and InMemory storage: commits on one
 * thread run one at a time, a waiting reflection goes first, model calls never hold the queue,
 * and every OM storage write runs inside a queued op.
 */
import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import type { SwapBufferedToActiveResult } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { getOMLockKey, isInOMCommit, runOMCommit, waitingOMCommits } from '../commit-queue';
import { AsyncBufferObservationStrategy } from '../observation-strategies/async-buffer';
import { ObservationalMemory } from '../observational-memory';

const SECRET = 'QUEUED_FACT_51d2';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function message(
  threadId: string,
  resourceId: string,
  id: string,
  text: string,
  createdAt: Date,
  role: 'user' | 'assistant' = 'user',
): MastraDBMessage {
  return {
    id,
    role,
    type: 'text',
    threadId,
    resourceId,
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function createOM(
  storage: InMemoryMemory,
  opts: { bufferTokens?: number | false; reflection?: { observationTokens: number; bufferActivation?: number } } = {},
) {
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini', messageTokens: 1_000, bufferTokens: opts.bufferTokens ?? 200 },
    reflection: { model: 'openai/gpt-4o-mini', ...(opts.reflection ?? { observationTokens: 2_000 }) },
  });
  vi.spyOn(om.observer, 'call').mockRejectedValue(new Error('Unexpected Observer call'));
  vi.spyOn(om.observer, 'callMultiThread').mockRejectedValue(new Error('Unexpected multi-thread Observer call'));
  vi.spyOn(om.reflector, 'call').mockRejectedValue(new Error('Unexpected Reflector call'));
  return om;
}

function observerReturns(om: ObservationalMemory, observations: string, gate?: Promise<void>) {
  vi.spyOn(om.observer, 'call').mockImplementation(async () => {
    await gate;
    return { observations } as Awaited<ReturnType<typeof om.observer.call>>;
  });
}

function reflectorReturns(om: ObservationalMemory, observations: string) {
  vi.spyOn(om.reflector, 'call').mockResolvedValue({ observations } as Awaited<ReturnType<typeof om.reflector.call>>);
}

async function setupThread(storage: InMemoryMemory) {
  const threadId = randomUUID();
  const resourceId = randomUUID();
  const t0 = new Date(Date.now() - 60_000);
  await storage.saveThread({ thread: { id: threadId, resourceId, title: 'queue', createdAt: t0, updatedAt: t0 } });
  return { threadId, resourceId, t0, key: getOMLockKey('thread', threadId, resourceId) };
}

/** Head with earlier observations and two unobserved messages after its cursor. */
async function seed(storage: InMemoryMemory, om: ObservationalMemory, ids: Awaited<ReturnType<typeof setupThread>>) {
  const messages = [
    message(
      ids.threadId,
      ids.resourceId,
      `m1-${ids.threadId}`,
      `${SECRET} ${'q'.repeat(1_200)}`,
      new Date(ids.t0.getTime() + 1_000),
    ),
    message(ids.threadId, ids.resourceId, `m2-${ids.threadId}`, 'ok', new Date(ids.t0.getTime() + 2_000), 'assistant'),
  ];
  await storage.saveMessages({ messages });
  const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
  await storage.updateActiveObservations({
    id: record.id,
    observations: '- earlier knowledge',
    tokenCount: 5_000,
    lastObservedAt: ids.t0,
  });
  return { messages, record: (await storage.getObservationalMemory(ids.threadId, ids.resourceId))! };
}

/** Records the order of storage writes and the record each targeted. */
function recordWrites(storage: InMemoryMemory) {
  const calls: Array<{ method: string; id: string }> = [];
  const wrap = <K extends 'appendBufferedObservations' | 'createReflectionGeneration' | 'swapBufferedToActive'>(
    method: K,
  ) => {
    const original = (storage[method] as (...args: any[]) => Promise<unknown>).bind(storage);
    vi.spyOn(storage, method).mockImplementation((async (input: any) => {
      calls.push({ method, id: input.id ?? input.currentRecord?.id });
      return original(input);
    }) as any);
  };
  wrap('appendBufferedObservations');
  wrap('createReflectionGeneration');
  wrap('swapBufferedToActive');
  return calls;
}

beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OM commit queue with real ObservationalMemory', () => {
  it('commits a waiting reflection before a waiting append; the append then lands on the new head', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const ids = await setupThread(storage);
    const { messages, record } = await seed(storage, om, ids);
    observerReturns(om, `- ${SECRET}`);
    reflectorReturns(om, '- reflected');
    const calls = recordWrites(storage);
    const appendQueued = deferred();
    const runCommit = (AsyncBufferObservationStrategy.prototype as any).runCommit;
    vi.spyOn(AsyncBufferObservationStrategy.prototype as any, 'runCommit').mockImplementation(function (
      this: unknown,
      op: unknown,
    ) {
      const result = runCommit.call(this, op);
      appendQueued.resolve();
      return result;
    });

    // Something else holds the thread's slot while the append and the reflection queue up.
    const hold = deferred();
    const holder = runOMCommit(ids.key, () => hold.promise);
    const buffering = om.buffer({ threadId: ids.threadId, resourceId: ids.resourceId, messages, record });
    await appendQueued.promise;
    const reflecting = om.reflect(ids.threadId, ids.resourceId);
    await vi.waitFor(() => expect(waitingOMCommits(ids.key).reflection).toBe(1));
    expect(calls).toEqual([]);

    hold.resolve();
    await holder;
    const [bufferResult, reflectResult] = await Promise.all([buffering, reflecting]);

    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    expect(reflectResult.reflected).toBe(true);
    expect(bufferResult.buffered).toBe(true);
    expect(head.generationCount).toBe(1);
    expect(calls.map(c => c.method)).toEqual(['createReflectionGeneration', 'appendBufferedObservations']);
    expect(calls[1]!.id).toBe(head.id);
    expect(head.bufferedObservationChunks?.map(c => c.observations)).toEqual([`- ${SECRET}`]);
    const retired = (await storage.getObservationalMemoryHistory(ids.threadId, ids.resourceId)).find(
      r => r.id === record.id,
    )!;
    expect(retired.bufferedObservationChunks ?? []).toEqual([]);
    await om.settled();
  });

  it('activation and rollover from two instances never activate from a retired record', async () => {
    for (let i = 0; i < 20; i++) {
      const storage = new InMemoryMemory({ db: new InMemoryDB() });
      const om = createOM(storage);
      const other = createOM(storage);
      const ids = await setupThread(storage);
      const { messages, record } = await seed(storage, om, ids);
      observerReturns(om, `- ${SECRET}`);
      await om.buffer({ threadId: ids.threadId, resourceId: ids.resourceId, messages, record });
      await om.waitForBuffering(ids.threadId, ids.resourceId, 5_000);
      reflectorReturns(other, '- reflected');
      const swaps: SwapBufferedToActiveResult[] = [];
      const originalSwap = storage.swapBufferedToActive.bind(storage);
      vi.spyOn(storage, 'swapBufferedToActive').mockImplementation(async input => {
        const result = await originalSwap(input);
        swaps.push(result);
        return result;
      });

      const [activation, reflection] = await Promise.all([
        om.activate({ threadId: ids.threadId, resourceId: ids.resourceId }),
        other.reflect(ids.threadId, ids.resourceId),
      ]);

      const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
      expect(swaps.filter(s => s.retired)).toEqual([]);
      expect(reflection.reflected).toBe(true);
      expect(activation.activated).toBe(true);
      expect(activation.activatedMessageIds).toEqual(messages.map(m => m.id));
      // The fact is on the head exactly once: activated into its text, nothing left buffered.
      expect(head.activeObservations.split(SECRET).length - 1).toBe(1);
      expect(head.bufferedObservationChunks ?? []).toEqual([]);
      await om.settled();
      await other.settled();
    }
  });

  it('a gated Observer call does not hold the queue', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const ids = await setupThread(storage);
    const { messages, record } = await seed(storage, om, ids);
    const gate = deferred();
    observerReturns(om, `- ${SECRET}`, gate.promise);
    reflectorReturns(om, '- reflected');

    const buffering = om.buffer({ threadId: ids.threadId, resourceId: ids.resourceId, messages, record });
    await vi.waitFor(() => expect(om.observer.call).toHaveBeenCalled());
    const reflection = await om.reflect(ids.threadId, ids.resourceId);
    expect(reflection.reflected).toBe(true);

    gate.resolve();
    await buffering;
    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    expect(head.bufferedObservationChunks?.map(c => c.observations)).toEqual([`- ${SECRET}`]);
    await om.settled();
  });

  it('two ObservationalMemory instances in one process share one queue per thread', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const other = createOM(storage);
    const ids = await setupThread(storage);
    const { record } = await seed(storage, om, ids);
    reflectorReturns(other, '- reflected');

    const hold = deferred();
    const holder = runOMCommit(ids.key, () => hold.promise);
    const reflecting = other.reflect(ids.threadId, ids.resourceId);
    await vi.waitFor(() => expect(waitingOMCommits(ids.key).reflection).toBe(1));
    expect((await storage.getObservationalMemory(ids.threadId, ids.resourceId))!.id).toBe(record.id);

    hold.resolve();
    await holder;
    expect((await reflecting).reflected).toBe(true);
    await other.settled();
  });
});

describe('every OM storage write runs inside a queued op', () => {
  const GUARDED = [
    'appendBufferedObservations',
    'swapBufferedToActive',
    'commitActiveObservations',
    'createReflectionGeneration',
    'swapBufferedReflectionToActive',
    'updateBufferedReflection',
    'setPendingMessageTokens',
    'setBufferingObservationFlag',
    'updateObservationalMemoryConfig',
  ] as const;

  it('buffer, activate, sync observe, sync reflect, buffered reflect, and config override', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const ids = await setupThread(storage);
    const om = createOM(storage, { reflection: { observationTokens: 2_000, bufferActivation: 0.5 } });
    const { messages, record } = await seed(storage, om, ids);
    // Seeding wrote directly; from here every write must come from OM.
    const unqueued: string[] = [];
    const called = new Set<string>();
    for (const method of GUARDED) {
      const original = (storage[method] as (...args: any[]) => Promise<unknown>).bind(storage);
      vi.spyOn(storage, method).mockImplementation((async (...args: any[]) => {
        called.add(method);
        if (!isInOMCommit(ids.key)) unqueued.push(method);
        return original(...args);
      }) as any);
    }

    // Buffer + activate (with a pending-token write before the swap).
    observerReturns(om, `- ${SECRET}`);
    await om.buffer({ threadId: ids.threadId, resourceId: ids.resourceId, messages, record });
    await om.waitForBuffering(ids.threadId, ids.resourceId, 5_000);
    const activation = await om.activate({ threadId: ids.threadId, resourceId: ids.resourceId, pendingTokens: 999 });
    expect(activation.activated).toBe(true);

    // Sync observation.
    const later = [
      message(
        ids.threadId,
        ids.resourceId,
        `m3-${ids.threadId}`,
        'w'.repeat(1_200),
        new Date(ids.t0.getTime() + 3_000),
      ),
    ];
    await storage.saveMessages({ messages: later });
    observerReturns(om, '- synced fact');
    await om.observe({ threadId: ids.threadId, resourceId: ids.resourceId, messages: later });

    // Sync reflection.
    reflectorReturns(om, '- reflected once');
    expect((await om.reflect(ids.threadId, ids.resourceId)).reflected).toBe(true);

    // Buffered reflection: buffer between half and full threshold, then activate above it.
    reflectorReturns(om, '- buffered reflection');
    const lines = (n: number, tag: string) =>
      Array.from({ length: n }, (_, i) => `- 🟢 ${tag} observation line with some substantive content ${i}`).join('\n');
    const mid = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    const midText = `${mid.activeObservations}\n${lines(110, 'mid')}`;
    const midTokens = om.getTokenCounter().countObservations(midText);
    expect(midTokens).toBeGreaterThan(1_000);
    expect(midTokens).toBeLessThan(2_000);
    await runOMCommit(ids.key, () =>
      storage.updateActiveObservations({ id: mid.id, observations: midText, tokenCount: midTokens }),
    );
    const beforeBuffer = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    await om.reflector.maybeReflect({
      record: beforeBuffer,
      observationTokens: midTokens,
      threadId: ids.threadId,
    });
    await vi.waitFor(async () =>
      expect((await storage.getObservationalMemory(ids.threadId, ids.resourceId))!.bufferedReflection).toBe(
        '- buffered reflection',
      ),
    );
    const grownText = `${midText}\n${lines(120, 'tail')}`;
    const grownTokens = om.getTokenCounter().countObservations(grownText);
    expect(grownTokens).toBeGreaterThanOrEqual(2_000);
    await runOMCommit(ids.key, () =>
      storage.updateActiveObservations({ id: beforeBuffer.id, observations: grownText, tokenCount: grownTokens }),
    );
    const grown = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    await om.reflector.maybeReflect({ record: grown, observationTokens: grownTokens, threadId: ids.threadId });
    await om.settled();
    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    expect(head.activeObservations).toContain('- buffered reflection');

    // Per-record config override.
    await om.updateRecordConfig(ids.threadId, ids.resourceId, { observation: { messageTokens: 9_000 } });

    expect(unqueued).toEqual([]);
    expect([...called].sort()).toEqual([...GUARDED].sort());
  });
});
