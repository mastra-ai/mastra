import { randomUUID } from 'node:crypto';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

export interface ObservationalMemoryConcurrencyStores {
  /** Two independent store instances (separate clients/connections) on the same database. */
  a: MemoryStorage;
  b: MemoryStorage;
  cleanup?: () => Promise<void>;
}

export interface ObservationalMemoryConcurrencyTestOptions {
  label: string;
  createStores: () => Promise<ObservationalMemoryConcurrencyStores>;
  /** Iterations per race (default 25). */
  iterations?: number;
  /** Per-test timeout in ms (default 120s). */
  timeout?: number;
}

/**
 * Cross-connection races for the observational memory lifecycle writes. Every race runs two
 * stores on the same database with `Promise.all` and then checks the lifecycle invariants:
 * one live record per key (the head), every appended chunk on the head exactly once (buffered
 * or activated), no chunk stranded on a retired record, and a cursor that never decreases.
 */
export function createObservationalMemoryConcurrencyTests({
  label,
  createStores,
  iterations = 25,
  timeout = 120_000,
}: ObservationalMemoryConcurrencyTestOptions) {
  describe(`${label} observational memory lifecycle concurrency`, () => {
    let stores: ObservationalMemoryConcurrencyStores;

    beforeAll(async () => {
      stores = await createStores();
    }, timeout);

    afterAll(async () => {
      await stores?.cleanup?.();
    }, timeout);

    const T0 = Date.parse('2026-01-10T12:00:00.000Z');
    const at = (ms: number) => new Date(T0 + ms);
    const newKey = () => ({
      threadId: `om-race-thread-${randomUUID()}`,
      resourceId: `om-race-resource-${randomUUID()}`,
      scope: 'thread' as const,
      config: {},
    });
    type Key = ReturnType<typeof newKey>;
    const chunkAt = (name: string, endMs: number) => {
      const tag = `${name}-${randomUUID()}`;
      return {
        cycleId: `cycle-${tag}`,
        observations: `- ${tag}`,
        tokenCount: 10,
        messageIds: [`msg-${tag}`],
        messageTokens: 500,
        lastObservedAt: at(endMs + 1),
      };
    };
    type Chunk = ReturnType<typeof chunkAt>;

    const head = async (key: Key) => (await stores.a.getObservationalMemory(key.threadId, key.resourceId))!;
    const rows = (key: Key) => stores.a.getObservationalMemoryHistory(key.threadId, key.resourceId, 100);
    const clone = (record: ObservationalMemoryRecord) => structuredClone(record);

    const seed = async (key: Key, chunks: Chunk[] = []) => {
      const record = await stores.a.initializeObservationalMemory(key);
      await stores.a.commitActiveObservations({
        id: record.id,
        observations: '- base',
        tokenCount: 10,
        lastObservedAt: at(0),
      });
      for (const chunk of chunks) {
        await stores.a.appendBufferedObservations({ id: record.id, chunk, lastBufferedAtTime: chunk.lastObservedAt });
      }
      return clone(await head(key));
    };

    const countOccurrences = (text: string, needle: string) => text.split(needle).length - 1;

    /** The lifecycle invariants every race must preserve. */
    const expectInvariants = async (key: Key, appended: Chunk[], cursorBefore: Date | undefined) => {
      const all = await rows(key);
      const current = await head(key);
      const live = all.filter(r => !r.supersededBy);
      expect(live.map(r => r.id)).toEqual([current.id]);

      for (const retired of all.filter(r => r.supersededBy)) {
        expect(retired.bufferedObservationChunks ?? []).toEqual([]);
      }

      const buffered = current.bufferedObservationChunks ?? [];
      for (const chunk of appended) {
        const bufferedCount = buffered.filter(c => c.cycleId === chunk.cycleId).length;
        const activeCount = countOccurrences(current.activeObservations, chunk.observations);
        expect(bufferedCount + activeCount, `chunk ${chunk.cycleId} on the head exactly once`).toBe(1);
      }

      if (cursorBefore) {
        expect(current.lastObservedAt, 'head cursor present').toBeDefined();
        expect(new Date(current.lastObservedAt!).getTime()).toBeGreaterThanOrEqual(cursorBefore.getTime());
      }
      return current;
    };

    it(
      'rollover vs append: the appended chunk lands on the head',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const first = chunkAt('first', 100);
          const snapshot = await seed(key, [first]);
          const late = chunkAt('late', 200);
          await Promise.all([
            stores.a.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 5 }),
            stores.b.appendBufferedObservations({
              id: snapshot.id,
              chunk: late,
              lastBufferedAtTime: late.lastObservedAt,
            }),
          ]);
          const current = await expectInvariants(key, [first, late], snapshot.lastObservedAt);
          expect(current.generationCount).toBe(1);
        }
      },
      timeout,
    );

    it(
      'rollover vs swap: activated observations reach the head; unactivated chunks move to it',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const one = chunkAt('one', 100);
          const two = chunkAt('two', 200);
          const snapshot = await seed(key, [one, two]);
          const [, swap] = await Promise.all([
            stores.a.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 5 }),
            stores.b.swapBufferedToActive({
              id: snapshot.id,
              activationRatio: 1,
              messageTokensThreshold: 1000,
              currentPendingTokens: 1000,
              bufferedChunks: snapshot.bufferedObservationChunks,
            }),
          ]);
          const current = await expectInvariants(key, [one, two], snapshot.lastObservedAt);
          if (swap.activatedMessageIds.length > 0) {
            expect(swap.retired ?? false).toBe(false);
            expect(current.activeObservations).toContain(one.observations);
          } else {
            expect(swap.chunksActivated).toBe(0);
          }
        }
      },
      timeout,
    );

    it(
      'swap vs append: a chunk appended after the caller read the record is never dropped',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const one = chunkAt('one', 100);
          const snapshot = await seed(key, [one]);
          const two = chunkAt('two', 200);
          await Promise.all([
            stores.a.swapBufferedToActive({
              id: snapshot.id,
              activationRatio: 1,
              messageTokensThreshold: 1000,
              currentPendingTokens: 500,
              bufferedChunks: snapshot.bufferedObservationChunks,
            }),
            stores.b.appendBufferedObservations({
              id: snapshot.id,
              chunk: two,
              lastBufferedAtTime: two.lastObservedAt,
            }),
          ]);
          await expectInvariants(key, [one, two], snapshot.lastObservedAt);
        }
      },
      timeout,
    );

    it(
      'duplicate append: the same cycle is stored once',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const snapshot = await seed(key);
          const chunk = chunkAt('dup', 100);
          const results = await Promise.all([
            stores.a.appendBufferedObservations({ id: snapshot.id, chunk }),
            stores.b.appendBufferedObservations({ id: snapshot.id, chunk }),
          ]);
          await expectInvariants(key, [chunk], snapshot.lastObservedAt);
          expect(results.filter(r => r && r.persisted).length).toBe(1);
        }
      },
      timeout,
    );

    it(
      'rollover vs rollover: exactly one reflection applies',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const chunk = chunkAt('carried', 100);
          const snapshot = await seed(key, [chunk]);
          const ids = [randomUUID(), randomUUID()];
          const results = await Promise.all([
            stores.a.createReflectionGeneration({
              currentRecord: snapshot,
              reflection: '- reflected a',
              tokenCount: 5,
              newRecordId: ids[0],
            }),
            stores.b.createReflectionGeneration({
              currentRecord: snapshot,
              reflection: '- reflected b',
              tokenCount: 5,
              newRecordId: ids[1],
            }),
          ]);
          const applied = results.filter((r, index) => r.id === ids[index]);
          expect(applied).toHaveLength(1);
          const current = await expectInvariants(key, [chunk], snapshot.lastObservedAt);
          expect(current.id).toBe(applied[0]!.id);
          expect(results.every(r => r.id === current.id)).toBe(true);
          expect(await rows(key)).toHaveLength(2);
        }
      },
      timeout,
    );

    it(
      'rollover vs active-observation commit: an applied commit reaches the head',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const chunk = chunkAt('carried', 100);
          const snapshot = await seed(key, [chunk]);
          const tail = `- committed-${randomUUID()}`;
          const appended = `${snapshot.activeObservations}\n${tail}`;
          const [, commit] = await Promise.all([
            stores.a.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 5 }),
            stores.b.commitActiveObservations({
              id: snapshot.id,
              observations: appended,
              tokenCount: 20,
              lastObservedAt: at(50),
              expectedActiveObservations: snapshot.activeObservations,
            }),
          ]);
          const current = await expectInvariants(key, [chunk], snapshot.lastObservedAt);
          expect(current.generationCount).toBe(1);
          if (commit && commit.applied) {
            // Committed before the rollover: the rollover keeps the appended tail.
            expect(current.activeObservations).toContain(tail);
            expect(new Date(current.lastObservedAt!).getTime()).toBe(at(50).getTime());
          } else {
            expect(commit).toEqual({ applied: false, reason: 'retired' });
            expect(current.activeObservations).not.toContain(tail);
          }
        }
      },
      timeout,
    );

    it(
      'rollover vs pending-token and buffering-flag writes: the values reach the head',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const chunk = chunkAt('carried', 100);
          const snapshot = await seed(key, [chunk]);
          await Promise.all([
            stores.a.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 5 }),
            stores.b.setPendingMessageTokens(snapshot.id, 777),
            stores.b.setBufferingObservationFlag(snapshot.id, true, 321),
          ]);
          const current = await expectInvariants(key, [chunk], snapshot.lastObservedAt);
          expect(current.generationCount).toBe(1);
          expect(current.pendingMessageTokens).toBe(777);
          expect(current.isBufferingObservation).toBe(true);
          expect(current.lastBufferedAtTokens).toBe(321);
        }
      },
      timeout,
    );

    it(
      'concurrent initialize: one live record',
      async () => {
        for (let i = 0; i < iterations; i++) {
          const key = newKey();
          const [first, second] = await Promise.all([
            stores.a.initializeObservationalMemory(key),
            stores.b.initializeObservationalMemory(key),
          ]);
          expect(first.id).toBe(second.id);
          expect((await rows(key)).map(r => r.id)).toEqual([first.id]);
          expect((await head(key)).id).toBe(first.id);
        }
      },
      timeout,
    );
  });
}
