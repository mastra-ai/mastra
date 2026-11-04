import {
  isAppendOnlySince,
  isBufferedChunkCoveredByCursor,
  maxObservationCursor,
  planReflectionGenerationText,
} from '@mastra/core/storage';
import type { GenericId } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';

import type { SerializedOMChunk, StorageRequest, StorageResponse } from '../storage/types';
import {
  deepMergeOMConfig,
  handleObservationalMemoryOperation,
  isAppendOnly,
  isChunkCoveredByCursor,
  maxCursor,
  mergeReflectionWithUnreflected,
  parseStoredChunks,
  planReflectionText,
  selectActivationBoundary,
} from './observational-memory';
import { mastraStorage } from './storage';

type OMOperationCtx = Parameters<typeof handleObservationalMemoryOperation>[0];
type StorageHandlerForTest = typeof mastraStorage & {
  _handler: (ctx: OMOperationCtx, request: StorageRequest) => Promise<StorageResponse>;
};

const OM_TABLE = 'mastra_observational_memory';

function storedOMDoc(overrides: Record<string, any> = {}) {
  return {
    id: 'om-1',
    lookupKey: 'resource:res-1',
    scope: 'resource',
    resourceId: 'res-1',
    threadId: null,
    activeObservations: '',
    activeObservationsPendingUpdate: null,
    originType: 'initial',
    config: '{}',
    generationCount: 0,
    lastObservedAt: null,
    lastReflectionAt: null,
    pendingMessageTokens: 0,
    totalTokensObserved: 0,
    observationTokenCount: 0,
    isObserving: false,
    isReflecting: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function serializedChunk(overrides: Partial<SerializedOMChunk> = {}): SerializedOMChunk {
  return {
    id: 'ombuf-1',
    cycleId: 'cycle-1',
    observations: 'observed something',
    tokenCount: 100,
    messageIds: ['msg-1'],
    messageTokens: 1000,
    lastObservedAt: '2026-06-01T01:00:00.000Z',
    createdAt: '2026-06-01T01:00:00.000Z',
    ...overrides,
  };
}

/**
 * In-memory fake of the Convex db surface used by the OM operations.
 * Emulates by_record_id (eq id) and by_lookup_key (eq lookupKey, gt/lt generationCount,
 * sorted by generationCount with .order() control) index semantics.
 */
function createFakeOMDb(initialDocs: Array<Record<string, any>>) {
  const docs = initialDocs.map((doc, index) => ({ _id: `doc-${index}` as GenericId<string>, ...doc }));
  const usedIndexes: string[] = [];
  const inserted: Array<{ table: string; doc: Record<string, any> }> = [];

  const db = {
    query: vi.fn((_table: string) => {
      let filtered: Array<Record<string, any>> = [...docs];
      let direction: 'asc' | 'desc' = 'asc';
      const ordered = () => (direction === 'desc' ? [...filtered].reverse() : filtered);
      const chain = {
        withIndex: (indexName: string, queryBuilder?: (q: any) => any) => {
          usedIndexes.push(indexName);
          const conditions: Array<(doc: Record<string, any>) => boolean> = [];
          const builder = {
            eq: (field: string, value: unknown) => {
              conditions.push(doc => doc[field] === value);
              return builder;
            },
            gt: (field: string, value: number) => {
              conditions.push(doc => doc[field] > value);
              return builder;
            },
            lt: (field: string, value: number) => {
              conditions.push(doc => doc[field] < value);
              return builder;
            },
          };
          queryBuilder?.(builder);
          filtered = filtered.filter(doc => conditions.every(condition => condition(doc)));
          if (indexName === 'by_lookup_key') {
            filtered.sort((a, b) => a.generationCount - b.generationCount);
          }
          return chain;
        },
        order: (dir: 'asc' | 'desc') => {
          direction = dir;
          return chain;
        },
        first: async () => ordered()[0] ?? null,
        collect: async () => ordered(),
        take: async (n: number) => ordered().slice(0, n),
        unique: async () => {
          if (filtered.length > 1) throw new Error('unique() matched more than one document');
          return filtered[0] ?? null;
        },
      };
      return chain;
    }),
    patch: vi.fn(async (_id: GenericId<string>, patch: Record<string, any>) => {
      const doc = docs.find(d => d._id === _id);
      if (!doc) throw new Error(`doc not found: ${String(_id)}`);
      Object.assign(doc, patch);
    }),
    insert: vi.fn(async (table: string, doc: Record<string, any>) => {
      const stored = { _id: `doc-inserted-${inserted.length}` as GenericId<string>, ...doc };
      docs.push(stored);
      inserted.push({ table, doc });
      return stored._id;
    }),
  };

  return { ctx: { db } as unknown as OMOperationCtx, db, docs, inserted, usedIndexes };
}

describe('parseStoredChunks', () => {
  it('parses a JSON array of chunks', () => {
    const chunk = serializedChunk();
    expect(parseStoredChunks(JSON.stringify([chunk]))).toEqual([chunk]);
  });

  it.each([[null], [undefined], [''], ['not-json'], ['{"a":1}']])('returns an empty array for %j', value => {
    expect(parseStoredChunks(value)).toEqual([]);
  });
});

describe('selectActivationBoundary', () => {
  it('activates everything when the target covers all chunks (ratio 1)', () => {
    const chunks = [{ messageTokens: 1000 }, { messageTokens: 1000 }, { messageTokens: 1000 }];
    expect(
      selectActivationBoundary(chunks, {
        activationRatio: 1,
        messageTokensThreshold: 3000,
        currentPendingTokens: 3000,
      }),
    ).toBe(3);
  });

  it('picks the boundary that lands the remaining context at the retention floor', () => {
    // floor = 5000 * (1 - 0.8) = 1000; target = 6000 - 1000 = 5000
    const chunks = [{ messageTokens: 3000 }, { messageTokens: 2000 }, { messageTokens: 2000 }];
    expect(
      selectActivationBoundary(chunks, {
        activationRatio: 0.8,
        messageTokensThreshold: 5000,
        currentPendingTokens: 6000,
      }),
    ).toBe(2);
  });

  it('falls back to the under boundary when the over boundary overshoots the floor', () => {
    // floor = 1000; target = 5000. Boundary 2 activates 6000 (overshoot 1000 > 950).
    const chunks = [{ messageTokens: 2000 }, { messageTokens: 4000 }];
    expect(
      selectActivationBoundary(chunks, {
        activationRatio: 0.8,
        messageTokensThreshold: 5000,
        currentPendingTokens: 6000,
      }),
    ).toBe(1);
  });

  it('prefers the over boundary under forceMaxActivation while respecting the minimum remaining tokens', () => {
    // floor = 25000; target = 5000. Boundary 2 activates 28900 (overshoot 23900 > 23750)
    // but leaves 1100 >= min(1000, floor) remaining, so force takes it.
    const chunks = [{ messageTokens: 4000 }, { messageTokens: 24900 }];
    const opts = {
      activationRatio: 0.5,
      messageTokensThreshold: 50000,
      currentPendingTokens: 30000,
    };
    expect(selectActivationBoundary(chunks, { ...opts, forceMaxActivation: true })).toBe(2);
    expect(selectActivationBoundary(chunks, opts)).toBe(1);
  });

  it('activates at least one chunk when every boundary violates the safeguards', () => {
    const chunks = [{ messageTokens: 0 }];
    expect(
      selectActivationBoundary(chunks, {
        activationRatio: 0.5,
        messageTokensThreshold: 1000,
        currentPendingTokens: 100,
      }),
    ).toBe(1);
  });
});

describe('mergeReflectionWithUnreflected', () => {
  it('returns only the reflection when all observation lines were reflected on', () => {
    expect(mergeReflectionWithUnreflected('line 1\nline 2', 'the reflection', 2)).toBe('the reflection');
  });

  it('appends observation lines added after the reflection started', () => {
    expect(mergeReflectionWithUnreflected('line 1\nline 2\nline 3\nline 4', 'the reflection', 2)).toBe(
      'the reflection\n\nline 3\nline 4',
    );
  });
});

describe('deepMergeOMConfig', () => {
  it('deep-merges nested objects and skips undefined source values', () => {
    expect(
      deepMergeOMConfig(
        { observation: { messageTokens: 1000, model: 'a' }, keep: true },
        { observation: { messageTokens: 2000, extra: 1 }, gone: undefined },
      ),
    ).toEqual({ observation: { messageTokens: 2000, model: 'a', extra: 1 }, keep: true });
  });
});

describe('handleObservationalMemoryOperation', () => {
  it('omGetLatest serves the highest generation through by_lookup_key descending', async () => {
    const { ctx, usedIndexes } = createFakeOMDb([
      storedOMDoc({ id: 'om-gen0', generationCount: 0 }),
      storedOMDoc({ id: 'om-gen2', generationCount: 2 }),
      storedOMDoc({ id: 'om-gen1', generationCount: 1 }),
      storedOMDoc({ id: 'om-other', lookupKey: 'resource:res-2', generationCount: 9 }),
    ]);

    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omGetLatest',
      tableName: OM_TABLE,
      lookupKey: 'resource:res-1',
    });

    expect(result.ok).toBe(true);
    expect((result as any).result).toMatchObject({ id: 'om-gen2', generationCount: 2 });
    expect(usedIndexes).toEqual(['by_lookup_key']);
  });

  it('omGetLatest returns null when no record exists', async () => {
    const { ctx } = createFakeOMDb([]);
    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omGetLatest',
      tableName: OM_TABLE,
      lookupKey: 'resource:missing',
    });
    expect(result).toEqual({ ok: true, result: null });
  });

  it('omGetHistory filters by createdAt range and applies offset and limit in descending order', async () => {
    const { ctx } = createFakeOMDb([
      storedOMDoc({ id: 'om-gen0', generationCount: 0, createdAt: '2026-06-01T00:00:00.000Z' }),
      storedOMDoc({ id: 'om-gen1', generationCount: 1, createdAt: '2026-06-02T00:00:00.000Z' }),
      storedOMDoc({ id: 'om-gen2', generationCount: 2, createdAt: '2026-06-03T00:00:00.000Z' }),
      storedOMDoc({ id: 'om-gen3', generationCount: 3, createdAt: '2026-06-04T00:00:00.000Z' }),
    ]);

    const all = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omGetHistory',
      tableName: OM_TABLE,
      lookupKey: 'resource:res-1',
      limit: 10,
    });
    expect((all as any).result.map((doc: any) => doc.id)).toEqual(['om-gen3', 'om-gen2', 'om-gen1', 'om-gen0']);

    const filtered = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omGetHistory',
      tableName: OM_TABLE,
      lookupKey: 'resource:res-1',
      limit: 1,
      from: '2026-06-02T00:00:00.000Z',
      to: '2026-06-03T23:59:59.000Z',
      offset: 1,
    });
    expect((filtered as any).result.map((doc: any) => doc.id)).toEqual(['om-gen1']);
  });

  it('omGetHistory finds literal group ids before ordering and limiting, including old records', async () => {
    const groupId = 'literal_%.$group';
    const group = `<observation-group id="${groupId}" range="m1:m2">body</observation-group>`;
    const { ctx } = createFakeOMDb([
      storedOMDoc({ id: 'other', lookupKey: 'resource:other', activeObservations: group }),
      storedOMDoc({ id: 'mention', activeObservations: groupId }),
      storedOMDoc({ id: 'first', generationCount: 1, activeObservations: group }),
      storedOMDoc({ id: 'carry', generationCount: 2, activeObservations: group }),
      ...Array.from({ length: 1001 }, (_, i) => storedOMDoc({ id: `later-${i}`, generationCount: i + 3 })),
    ]);
    const request = {
      op: 'omGetHistory' as const,
      tableName: OM_TABLE,
      lookupKey: 'resource:res-1',
      groupId,
      limit: 1,
      sortDirection: 'ASC' as const,
    };
    const first = await handleObservationalMemoryOperation(ctx, OM_TABLE, request);
    expect((first as any).result.map((doc: any) => doc.id)).toEqual(['first']);
    const next = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      ...request,
      afterGeneration: 1,
      beforeGeneration: 3,
    });
    expect((next as any).result.map((doc: any) => doc.id)).toEqual(['carry']);
    const offset = await handleObservationalMemoryOperation(ctx, OM_TABLE, { ...request, offset: 1 });
    expect((offset as any).result.map((doc: any) => doc.id)).toEqual(['carry']);
  });

  it('omGetHistory reads generations in the requested direction so old groups stay findable past the row cap', async () => {
    const groupId = 'oldest-group';
    const { ctx } = createFakeOMDb([
      storedOMDoc({
        id: 'first',
        generationCount: 0,
        activeObservations: `<observation-group id="${groupId}" range="a:b">body</observation-group>`,
      }),
      ...Array.from({ length: 10_005 }, (_, i) => storedOMDoc({ id: `later-${i}`, generationCount: i + 1 })),
    ]);
    const request = { op: 'omGetHistory' as const, tableName: OM_TABLE, lookupKey: 'resource:res-1', limit: 1 };
    const oldest = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      ...request,
      groupId,
      sortDirection: 'ASC',
    });
    expect((oldest as any).result.map((doc: any) => doc.id)).toEqual(['first']);
    const before = await handleObservationalMemoryOperation(ctx, OM_TABLE, { ...request, beforeGeneration: 3 });
    expect((before as any).result.map((doc: any) => doc.id)).toEqual(['later-1']);
    const after = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      ...request,
      afterGeneration: 1,
      sortDirection: 'ASC',
    });
    expect((after as any).result.map((doc: any) => doc.id)).toEqual(['later-1']);
  });

  it('omGetHistory matches buffered originals on older generations without changing stored chunks', async () => {
    const groupId = 'buffered_%.$group';
    const bufferedObservationChunks = JSON.stringify([
      { observations: `<observation-group id="${groupId}" range="a:b">body</observation-group>` },
    ]);
    const { ctx } = createFakeOMDb([
      storedOMDoc({ id: 'buffered', generationCount: 0, bufferedObservationChunks }),
      storedOMDoc({ id: 'newer', generationCount: 1 }),
    ]);
    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omGetHistory',
      tableName: OM_TABLE,
      lookupKey: 'resource:res-1',
      groupId,
      limit: 1,
      sortDirection: 'ASC',
    });
    expect((result as any).result.map((doc: any) => doc.id)).toEqual(['buffered']);
    expect((result as any).result[0].bufferedObservationChunks).toBe(bufferedObservationChunks);
  });

  it('omUpdateActive increments totalTokensObserved and resets pendingMessageTokens', async () => {
    const { ctx, db, docs } = createFakeOMDb([storedOMDoc({ totalTokensObserved: 500, pendingMessageTokens: 1200 })]);

    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omUpdateActive',
      tableName: OM_TABLE,
      id: 'om-1',
      observations: 'new observations',
      tokenCount: 300,
      lastObservedAt: '2026-06-05T00:00:00.000Z',
      observedMessageIds: ['msg-1', 'msg-2'],
      updatedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true, result: { applied: true } });
    expect(db.patch).toHaveBeenCalledTimes(1);
    expect(docs[0]).toMatchObject({
      activeObservations: 'new observations',
      observationTokenCount: 300,
      totalTokensObserved: 800,
      pendingMessageTokens: 0,
      observedMessageIds: ['msg-1', 'msg-2'],
      lastObservedAt: '2026-06-05T00:00:00.000Z',
      updatedAt: '2026-06-05T00:00:00.000Z',
    });
  });

  it('throws a not-found error for updates against missing records', async () => {
    const { ctx } = createFakeOMDb([]);
    await expect(
      handleObservationalMemoryOperation(ctx, OM_TABLE, {
        op: 'omUpdateActive',
        tableName: OM_TABLE,
        id: 'missing',
        observations: '',
        tokenCount: 0,
        lastObservedAt: '2026-06-05T00:00:00.000Z',
        observedMessageIds: null,
        updatedAt: '2026-06-05T00:00:00.000Z',
      }),
    ).rejects.toThrow('Observational memory record not found: missing');
  });

  it('omAppendBufferedChunk appends to the stored chunk array and updates the buffer cursor', async () => {
    const existingChunk = serializedChunk({ id: 'ombuf-0', cycleId: 'cycle-0' });
    const { ctx, docs } = createFakeOMDb([storedOMDoc({ bufferedObservationChunks: JSON.stringify([existingChunk]) })]);

    const newChunk = serializedChunk({ id: 'ombuf-2', cycleId: 'cycle-2' });
    await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omAppendBufferedChunk',
      tableName: OM_TABLE,
      id: 'om-1',
      chunk: newChunk,
      lastBufferedAtTime: '2026-06-05T02:00:00.000Z',
      updatedAt: '2026-06-05T02:00:00.000Z',
    });

    expect(JSON.parse(docs[0]!.bufferedObservationChunks)).toEqual([existingChunk, newChunk]);
    expect(docs[0]).toMatchObject({ lastBufferedAtTime: '2026-06-05T02:00:00.000Z' });
  });

  it('omSwapBuffered activates chunks, appends with a message boundary, and clears the buffer', async () => {
    const chunkA = serializedChunk({
      id: 'ombuf-a',
      cycleId: 'cycle-a',
      observations: 'obs A',
      tokenCount: 50,
      messageIds: ['msg-1', 'msg-2'],
      messageTokens: 1000,
      suggestedContinuation: 'stale hint',
    });
    const chunkB = serializedChunk({
      id: 'ombuf-b',
      cycleId: 'cycle-b',
      observations: 'obs B',
      tokenCount: 70,
      messageIds: ['msg-3'],
      messageTokens: 1000,
      lastObservedAt: '2026-06-01T02:00:00.000Z',
      suggestedContinuation: 'fresh hint',
      currentTask: 'the task',
    });
    const { ctx, docs } = createFakeOMDb([
      storedOMDoc({
        activeObservations: 'existing observations',
        observationTokenCount: 10,
        pendingMessageTokens: 2500,
        bufferedObservationChunks: JSON.stringify([chunkA, chunkB]),
      }),
    ]);

    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omSwapBuffered',
      tableName: OM_TABLE,
      id: 'om-1',
      activationRatio: 1,
      messageTokensThreshold: 2000,
      currentPendingTokens: 2000,
      now: '2026-06-05T03:00:00.000Z',
    });

    expect((result as any).result).toMatchObject({
      chunksActivated: 2,
      messageTokensActivated: 2000,
      observationTokensActivated: 120,
      messagesActivated: 3,
      activatedCycleIds: ['cycle-a', 'cycle-b'],
      activatedMessageIds: ['msg-1', 'msg-2', 'msg-3'],
      observations: 'obs A\n\nobs B',
      suggestedContinuation: 'fresh hint',
      currentTask: 'the task',
    });
    expect(docs[0]).toMatchObject({
      activeObservations: `existing observations\n\n--- message boundary (2026-06-01T02:00:00.000Z) ---\n\nobs A\n\nobs B`,
      observationTokenCount: 130,
      pendingMessageTokens: 500,
      bufferedObservationChunks: null,
      lastObservedAt: '2026-06-01T02:00:00.000Z',
      updatedAt: '2026-06-05T03:00:00.000Z',
    });
  });

  it('omSwapBuffered reports zero activation when nothing is buffered', async () => {
    const { ctx, db } = createFakeOMDb([storedOMDoc({ bufferedObservationChunks: null })]);

    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omSwapBuffered',
      tableName: OM_TABLE,
      id: 'om-1',
      activationRatio: 1,
      messageTokensThreshold: 2000,
      currentPendingTokens: 2000,
      // Refreshed chunks from a stale read must not resurrect an already-swapped buffer.
      bufferedChunks: [serializedChunk()],
      now: '2026-06-05T03:00:00.000Z',
    });

    expect((result as any).result).toMatchObject({ chunksActivated: 0, activatedMessageIds: [] });
    expect(db.patch).not.toHaveBeenCalled();
  });

  it('omUpdateBufferedReflection appends content and accumulates token counters', async () => {
    const { ctx, docs } = createFakeOMDb([
      storedOMDoc({
        bufferedReflection: 'first part',
        bufferedReflectionTokens: 100,
        bufferedReflectionInputTokens: 1000,
      }),
    ]);

    await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omUpdateBufferedReflection',
      tableName: OM_TABLE,
      id: 'om-1',
      reflection: 'second part',
      tokenCount: 50,
      inputTokenCount: 500,
      reflectedObservationLineCount: 12,
      updatedAt: '2026-06-05T04:00:00.000Z',
    });

    expect(docs[0]).toMatchObject({
      bufferedReflection: 'first part\n\nsecond part',
      bufferedReflectionTokens: 150,
      bufferedReflectionInputTokens: 1500,
      reflectedObservationLineCount: 12,
    });
  });

  it('omSwapBufferedReflection creates the next generation and clears the buffered state', async () => {
    const { ctx, docs, inserted } = createFakeOMDb([
      storedOMDoc({
        activeObservations: 'line 1\nline 2\nline 3',
        bufferedReflection: 'the reflection',
        bufferedReflectionTokens: 80,
        bufferedReflectionInputTokens: 800,
        reflectedObservationLineCount: 2,
        generationCount: 1,
        // The new generation is built from the stored record, not the caller's snapshot.
        observedTimezone: 'Europe/Berlin',
        totalTokensObserved: 900,
      }),
    ]);

    const result = await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omSwapBufferedReflection',
      tableName: OM_TABLE,
      currentRecord: {
        id: 'om-1',
        lookupKey: 'resource:res-1',
        scope: 'resource',
        threadId: null,
        resourceId: 'res-1',
        config: '{"observation":{"messageTokens":1000}}',
        metadata: null,
        observedTimezone: 'Europe/Berlin',
        lastObservedAt: '2026-06-04T00:00:00.000Z',
        totalTokensObserved: 900,
        generationCount: 1,
      },
      newId: 'om-2',
      tokenCount: 95,
      now: '2026-06-05T05:00:00.000Z',
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.table).toBe(OM_TABLE);
    expect((result as any).result).toMatchObject({
      id: 'om-2',
      lookupKey: 'resource:res-1',
      originType: 'reflection',
      generationCount: 2,
      activeObservations: 'the reflection\n\nline 3',
      observationTokenCount: 95,
      totalTokensObserved: 900,
      lastReflectionAt: '2026-06-05T05:00:00.000Z',
      observedTimezone: 'Europe/Berlin',
      isBufferingReflection: false,
    });
    // Old record's buffered state is cleared
    expect(docs[0]).toMatchObject({
      bufferedReflection: null,
      bufferedReflectionTokens: null,
      bufferedReflectionInputTokens: null,
      reflectedObservationLineCount: null,
      updatedAt: '2026-06-05T05:00:00.000Z',
    });
  });

  it('omSwapBufferedReflection throws when no reflection is buffered', async () => {
    const { ctx } = createFakeOMDb([storedOMDoc({ bufferedReflection: null })]);
    await expect(
      handleObservationalMemoryOperation(ctx, OM_TABLE, {
        op: 'omSwapBufferedReflection',
        tableName: OM_TABLE,
        currentRecord: {
          id: 'om-1',
          lookupKey: 'resource:res-1',
          scope: 'resource',
          threadId: null,
          resourceId: 'res-1',
          config: '{}',
          metadata: null,
          observedTimezone: null,
          lastObservedAt: null,
          totalTokensObserved: 0,
          generationCount: 0,
        },
        newId: 'om-2',
        tokenCount: 0,
        now: '2026-06-05T05:00:00.000Z',
      }),
    ).rejects.toThrow('No buffered reflection to swap');
  });

  it('omUpdateConfig deep-merges the incoming config into the stored config', async () => {
    const { ctx, docs } = createFakeOMDb([
      storedOMDoc({ config: JSON.stringify({ observation: { messageTokens: 1000, model: 'a' }, keep: true }) }),
    ]);

    await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      op: 'omUpdateConfig',
      tableName: OM_TABLE,
      id: 'om-1',
      config: JSON.stringify({ observation: { messageTokens: 2000 } }),
      updatedAt: '2026-06-05T06:00:00.000Z',
    });

    expect(JSON.parse(docs[0]!.config)).toEqual({
      observation: { messageTokens: 2000, model: 'a' },
      keep: true,
    });
  });
});

describe('mastraStorage routing for observational memory', () => {
  it('routes the observational memory table to the typed table instead of mastra_documents', async () => {
    const { ctx, db } = createFakeOMDb([storedOMDoc()]);

    const result = await (mastraStorage as StorageHandlerForTest)._handler(ctx, {
      op: 'omGetLatest',
      tableName: OM_TABLE,
      lookupKey: 'resource:res-1',
    });

    expect(result.ok).toBe(true);
    expect((result as any).result).toMatchObject({ id: 'om-1' });
    expect(db.query).toHaveBeenCalledWith(OM_TABLE);
    expect(db.query).not.toHaveBeenCalledWith('mastra_documents');
  });

  it('rejects om operations against other tables', async () => {
    const { ctx } = createFakeOMDb([]);
    await expect(
      (mastraStorage as StorageHandlerForTest)._handler(ctx, {
        op: 'omGetLatest',
        tableName: 'mastra_threads',
        lookupKey: 'resource:res-1',
      }),
    ).rejects.toThrow('omGetLatest is only supported for mastra_observational_memory');
  });
});

describe('lifecycle rule parity with @mastra/core', () => {
  // The server bundle cannot import @mastra/core at runtime, so it carries copies of the
  // shared lifecycle rules. These must decide exactly like the core helpers.
  it('isChunkCoveredByCursor matches isBufferedChunkCoveredByCursor', () => {
    const chunk = '2026-06-01T00:00:00.010Z';
    for (const cursor of [
      null,
      '2026-06-01T00:00:00.008Z',
      '2026-06-01T00:00:00.009Z',
      '2026-06-01T00:00:00.010Z',
      '2026-06-02T00:00:00.000Z',
    ]) {
      expect(isChunkCoveredByCursor(chunk, cursor)).toBe(isBufferedChunkCoveredByCursor(chunk, cursor));
    }
  });

  it('maxCursor matches maxObservationCursor', () => {
    const a = '2026-06-01T00:00:00.000Z';
    const b = '2026-06-02T00:00:00.000Z';
    for (const [x, y] of [
      [a, b],
      [b, a],
      [a, null],
      [null, b],
      [null, null],
    ] as const) {
      expect(maxCursor(x, y)).toBe(maxObservationCursor(x, y)?.toISOString() ?? null);
    }
  });

  it('planReflectionText and isAppendOnly match the core rules', () => {
    const cases = [
      { stored: 'a\nb', snapshot: 'a\nb' },
      { stored: 'a\nb\n\n--- message boundary (x) ---\n\nc', snapshot: 'a\nb' },
      { stored: 'a\nb   ', snapshot: 'a\nb' },
      { stored: 'rewritten', snapshot: 'a\nb' },
      { stored: 'tail only', snapshot: '' },
    ];
    for (const { stored, snapshot } of cases) {
      for (const reflection of ['R', '']) {
        const input = {
          storedObservations: stored,
          storedObservationTokenCount: 30,
          snapshotObservations: snapshot,
          snapshotObservationTokenCount: 10,
          reflection,
          tokenCount: 5,
        };
        const core = planReflectionGenerationText(input);
        expect(planReflectionText(input)).toEqual(
          core ? { observations: core.observations, tokenCount: core.tokenCount } : null,
        );
      }
      expect(isAppendOnly(stored, snapshot)).toBe(isAppendOnlySince(stored, snapshot));
    }
  });
});

describe('observational memory lifecycle (supersededBy)', () => {
  const NOW = '2026-06-10T00:00:00.000Z';

  function snapshotOf(doc: Record<string, any>) {
    return {
      id: doc.id,
      lookupKey: doc.lookupKey,
      scope: doc.scope,
      threadId: doc.threadId ?? null,
      resourceId: doc.resourceId,
      config: doc.config,
      metadata: doc.metadata ?? null,
      observedTimezone: doc.observedTimezone ?? null,
      lastObservedAt: doc.lastObservedAt ?? null,
      totalTokensObserved: doc.totalTokensObserved,
      generationCount: doc.generationCount,
      activeObservations: doc.activeObservations,
      observationTokenCount: doc.observationTokenCount,
    };
  }

  async function run(ctx: OMOperationCtx, request: Record<string, unknown>) {
    return (await handleObservationalMemoryOperation(ctx, OM_TABLE, {
      tableName: OM_TABLE,
      ...request,
    } as any)) as any;
  }

  const byId = (docs: Array<Record<string, any>>, id: string) => docs.find(doc => doc.id === id)!;

  it('omGetLatest returns the canonical head among pre-M3 duplicates (generationCount DESC, createdAt ASC, id ASC)', async () => {
    const { ctx } = createFakeOMDb([
      storedOMDoc({ id: 'g0', generationCount: 0 }),
      storedOMDoc({ id: 'g1', generationCount: 1 }),
      storedOMDoc({ id: 'g2-b', generationCount: 2, createdAt: '2026-06-03T00:00:00.000Z' }),
      storedOMDoc({ id: 'g2-a', generationCount: 2, createdAt: '2026-06-03T00:00:00.000Z' }),
      // Inserted last (newest _creationTime) and later createdAt: descending first() alone would pick it.
      storedOMDoc({ id: 'g2-0', generationCount: 2, createdAt: '2026-06-04T00:00:00.000Z' }),
    ]);

    const result = await run(ctx, { op: 'omGetLatest', lookupKey: 'resource:res-1' });

    expect(result.result.id).toBe('g2-a');
  });

  it('a write aimed at a non-head duplicate or older generation marks it superseded by the head; untargeted rows stay unmarked', async () => {
    const { ctx, docs } = createFakeOMDb([
      storedOMDoc({ id: 'g0', generationCount: 0 }),
      storedOMDoc({ id: 'g1', generationCount: 1 }),
      storedOMDoc({ id: 'g1-dup', generationCount: 1, createdAt: '2026-06-02T00:00:00.000Z' }),
    ]);

    const result = await run(ctx, {
      op: 'omUpdateActive',
      id: 'g1-dup',
      observations: 'lost?',
      tokenCount: 1,
      lastObservedAt: NOW,
      observedMessageIds: null,
      updatedAt: NOW,
    });

    expect(result.result).toEqual({ applied: false, reason: 'retired' });
    expect(byId(docs, 'g1-dup')).toMatchObject({ supersededBy: 'g1', activeObservations: '' });
    expect(byId(docs, 'g0').supersededBy).toBeUndefined();
    expect(byId(docs, 'g1').supersededBy).toBeUndefined();
  });

  it('a write aimed at the canonical head succeeds and never marks it superseded', async () => {
    const { ctx, docs } = createFakeOMDb([
      storedOMDoc({ id: 'g1', generationCount: 1 }),
      storedOMDoc({ id: 'g1-dup', generationCount: 1, createdAt: '2026-06-02T00:00:00.000Z' }),
    ]);

    const result = await run(ctx, {
      op: 'omUpdateActive',
      id: 'g1',
      observations: 'kept',
      tokenCount: 1,
      lastObservedAt: NOW,
      observedMessageIds: null,
      updatedAt: NOW,
    });

    expect(result.result).toEqual({ applied: true });
    expect(byId(docs, 'g1')).toMatchObject({ activeObservations: 'kept' });
    expect(byId(docs, 'g1').supersededBy).toBeUndefined();
  });

  it('omInitialize inserts the deterministic record once; a second initialize returns the existing head', async () => {
    const { ctx, docs } = createFakeOMDb([]);
    const record = { ...storedOMDoc({ id: 'om0_key' }) };

    const first = await run(ctx, { op: 'omInitialize', record });
    const second = await run(ctx, { op: 'omInitialize', record: { ...record, id: 'om0_other' } });

    expect(docs).toHaveLength(1);
    expect(first.result).toMatchObject({ id: 'om0_key', supersededBy: null });
    expect(second.result.id).toBe('om0_key');
  });

  describe('omCreateReflectionGeneration', () => {
    const chunkA = serializedChunk({ id: 'c-a', cycleId: 'cycle-a', lastObservedAt: '2026-06-01T05:00:00.000Z' });

    function headDoc(overrides: Record<string, any> = {}) {
      return storedOMDoc({
        id: 'g0',
        activeObservations: 'old line',
        observationTokenCount: 10,
        totalTokensObserved: 500,
        pendingMessageTokens: 700,
        lastObservedAt: '2026-06-01T03:00:00.000Z',
        lastBufferedAtTime: '2026-06-01T05:00:00.000Z',
        lastBufferedAtTokens: 1200,
        isBufferingObservation: true,
        bufferedObservationChunks: JSON.stringify([chunkA]),
        bufferedReflection: 'pending reflection',
        bufferedReflectionTokens: 9,
        observedTimezone: 'Europe/Berlin',
        ...overrides,
      });
    }

    it('moves buffered chunks to the new head, carries cursor/flags/counters, does not carry buffered reflection, and retires the old row', async () => {
      const { ctx, docs } = createFakeOMDb([headDoc()]);

      const result = await run(ctx, {
        op: 'omCreateReflectionGeneration',
        currentRecord: snapshotOf(headDoc()),
        newId: 'g1',
        reflection: 'reflected',
        tokenCount: 4,
        now: NOW,
      });

      expect(result.result).toMatchObject({
        id: 'g1',
        generationCount: 1,
        originType: 'reflection',
        activeObservations: 'reflected',
        observationTokenCount: 4,
        lastObservedAt: '2026-06-01T03:00:00.000Z',
        lastBufferedAtTime: '2026-06-01T05:00:00.000Z',
        lastBufferedAtTokens: 1200,
        pendingMessageTokens: 700,
        totalTokensObserved: 500,
        isBufferingObservation: true,
        observedTimezone: 'Europe/Berlin',
        supersededBy: null,
      });
      expect(result.result).not.toHaveProperty('bufferedReflection');
      expect(parseStoredChunks(byId(docs, 'g1').bufferedObservationChunks)).toEqual([chunkA]);
      expect(byId(docs, 'g0')).toMatchObject({ supersededBy: 'g1', bufferedObservationChunks: null });
    });

    it('keeps observations appended after the snapshot and adds their tokens', async () => {
      const appended = headDoc({
        activeObservations: 'old line\n\n--- message boundary (t) ---\n\nnew fact',
        observationTokenCount: 25,
      });
      const { ctx } = createFakeOMDb([appended]);

      const result = await run(ctx, {
        op: 'omCreateReflectionGeneration',
        currentRecord: snapshotOf(headDoc()),
        newId: 'g1',
        reflection: 'reflected',
        tokenCount: 4,
        now: NOW,
      });

      expect(result.result).toMatchObject({
        activeObservations: 'reflected\n\n--- message boundary (t) ---\n\nnew fact',
        observationTokenCount: 4 + 15,
      });
    });

    it('creates nothing when the stored text was rewritten since the snapshot', async () => {
      const { ctx, docs, inserted } = createFakeOMDb([headDoc({ activeObservations: 'rewritten' })]);

      const result = await run(ctx, {
        op: 'omCreateReflectionGeneration',
        currentRecord: snapshotOf(headDoc()),
        newId: 'g1',
        reflection: 'reflected',
        tokenCount: 4,
        now: NOW,
      });

      expect(inserted).toHaveLength(0);
      expect(result.result.id).toBe('g0');
      expect(byId(docs, 'g0').supersededBy).toBeUndefined();
    });

    it('creates nothing for a retired snapshot and returns the head', async () => {
      const { ctx, inserted } = createFakeOMDb([
        headDoc({ supersededBy: 'g1' }),
        storedOMDoc({ id: 'g1', generationCount: 1 }),
      ]);

      const result = await run(ctx, {
        op: 'omCreateReflectionGeneration',
        currentRecord: snapshotOf(headDoc()),
        newId: 'g1-again',
        reflection: 'reflected',
        tokenCount: 4,
        now: NOW,
      });

      expect(inserted).toHaveLength(0);
      expect(result.result.id).toBe('g1');
    });

    it('returns null and creates nothing when the target is missing', async () => {
      const { ctx, inserted } = createFakeOMDb([]);

      const result = await run(ctx, {
        op: 'omCreateReflectionGeneration',
        currentRecord: snapshotOf(headDoc()),
        newId: 'g1',
        reflection: 'reflected',
        tokenCount: 4,
        now: NOW,
      });

      expect(inserted).toHaveLength(0);
      expect(result.result).toBeNull();
    });

    it('per-mutation liveness check vs rollover leaves exactly one live row, the canonical head', async () => {
      const { ctx, docs } = createFakeOMDb([
        headDoc(),
        storedOMDoc({ id: 'g0-dup', createdAt: '2026-06-05T00:00:00.000Z' }),
      ]);

      await run(ctx, { op: 'omSetPendingMessageTokens', id: 'g0-dup', tokenCount: 3, updatedAt: NOW });
      await run(ctx, {
        op: 'omCreateReflectionGeneration',
        currentRecord: snapshotOf(headDoc()),
        newId: 'g1',
        reflection: 'reflected',
        tokenCount: 4,
        now: NOW,
      });

      expect(docs.filter(doc => !doc.supersededBy).map(doc => doc.id)).toEqual(['g1']);
      expect(byId(docs, 'g0-dup').supersededBy).toBe('g0');
      // The counter write was redirected to the head (and carried into g1).
      expect(byId(docs, 'g1').pendingMessageTokens).toBe(3);
    });
  });

  it('omSwapBufferedReflection checks liveness before the no-buffered-reflection throw', async () => {
    const { ctx, inserted } = createFakeOMDb([
      storedOMDoc({ id: 'g0', supersededBy: 'g1', bufferedReflection: null }),
      storedOMDoc({ id: 'g1', generationCount: 1 }),
    ]);

    const result = await run(ctx, {
      op: 'omSwapBufferedReflection',
      currentRecord: snapshotOf(storedOMDoc({ id: 'g0' })),
      newId: 'g1-again',
      tokenCount: 1,
      now: NOW,
    });

    expect(inserted).toHaveLength(0);
    expect(result.result.id).toBe('g1');
  });

  it('omSwapBufferedReflection moves chunks and keeps observations appended after the snapshot', async () => {
    const chunk = serializedChunk({ id: 'c-1', cycleId: 'cycle-1' });
    const stored = storedOMDoc({
      id: 'g0',
      activeObservations: 'l1\nl2\n\n--- message boundary (t) ---\n\nnew fact',
      observationTokenCount: 30,
      bufferedReflection: 'R',
      reflectedObservationLineCount: 2,
      bufferedObservationChunks: JSON.stringify([chunk]),
    });
    const { ctx, docs } = createFakeOMDb([stored]);

    const result = await run(ctx, {
      op: 'omSwapBufferedReflection',
      currentRecord: snapshotOf({ ...stored, activeObservations: 'l1\nl2', observationTokenCount: 20 }),
      newId: 'g1',
      tokenCount: 5,
      now: NOW,
    });

    expect(result.result.activeObservations).toContain('new fact');
    expect(result.result.observationTokenCount).toBe(15);
    expect(parseStoredChunks(byId(docs, 'g1').bufferedObservationChunks)).toEqual([chunk]);
    expect(byId(docs, 'g0')).toMatchObject({
      supersededBy: 'g1',
      bufferedObservationChunks: null,
      bufferedReflection: null,
    });
  });

  describe('omAppendBufferedChunk', () => {
    it('redirects an append aimed at a retired generation to the head', async () => {
      const { ctx, docs } = createFakeOMDb([
        storedOMDoc({ id: 'g0', supersededBy: 'g1' }),
        storedOMDoc({ id: 'g1', generationCount: 1 }),
      ]);

      const result = await run(ctx, {
        op: 'omAppendBufferedChunk',
        id: 'g0',
        chunk: serializedChunk(),
        lastBufferedAtTime: NOW,
        updatedAt: NOW,
      });

      expect(result.result).toEqual({ persisted: true, recordId: 'g1' });
      expect(parseStoredChunks(byId(docs, 'g1').bufferedObservationChunks)).toHaveLength(1);
      expect(byId(docs, 'g0').bufferedObservationChunks).toBeUndefined();
    });

    it('skips a retried append with the same cycleId', async () => {
      const chunk = serializedChunk();
      const { ctx, docs } = createFakeOMDb([storedOMDoc({ bufferedObservationChunks: JSON.stringify([chunk]) })]);

      const result = await run(ctx, {
        op: 'omAppendBufferedChunk',
        id: 'om-1',
        chunk: { ...chunk, id: 'retry' },
        updatedAt: NOW,
      });

      expect(result.result).toEqual({ persisted: false, recordId: 'om-1' });
      expect(parseStoredChunks(docs[0]!.bufferedObservationChunks)).toHaveLength(1);
    });

    it('skips a chunk the cursor wholly covers (cursor T, chunk T+1ms) but stores one past it (chunk T+2ms)', async () => {
      const cursor = '2026-06-01T01:00:00.000Z';
      const { ctx, docs } = createFakeOMDb([storedOMDoc({ lastObservedAt: cursor })]);

      const covered = await run(ctx, {
        op: 'omAppendBufferedChunk',
        id: 'om-1',
        chunk: serializedChunk({ cycleId: 'c-covered', lastObservedAt: '2026-06-01T01:00:00.001Z' }),
        updatedAt: NOW,
      });
      const uncovered = await run(ctx, {
        op: 'omAppendBufferedChunk',
        id: 'om-1',
        chunk: serializedChunk({ cycleId: 'c-new', lastObservedAt: '2026-06-01T01:00:00.002Z' }),
        updatedAt: NOW,
      });

      expect(covered.result.persisted).toBe(false);
      expect(uncovered.result.persisted).toBe(true);
      expect(parseStoredChunks(docs[0]!.bufferedObservationChunks).map(c => c.cycleId)).toEqual(['c-new']);
    });

    it('never moves lastBufferedAtTime backward', async () => {
      const { ctx, docs } = createFakeOMDb([storedOMDoc({ lastBufferedAtTime: '2026-06-05T00:00:00.000Z' })]);

      await run(ctx, {
        op: 'omAppendBufferedChunk',
        id: 'om-1',
        chunk: serializedChunk(),
        lastBufferedAtTime: '2026-06-04T00:00:00.000Z',
        updatedAt: NOW,
      });

      expect(docs[0]!.lastBufferedAtTime).toBe('2026-06-05T00:00:00.000Z');
    });

    it('throws for a missing record', async () => {
      const { ctx } = createFakeOMDb([]);
      await expect(
        run(ctx, { op: 'omAppendBufferedChunk', id: 'missing', chunk: serializedChunk(), updatedAt: NOW }),
      ).rejects.toThrow('Observational memory record not found: missing');
    });
  });

  describe('omSwapBuffered', () => {
    it('writes nothing on a retired generation and reports retired', async () => {
      const { ctx, db } = createFakeOMDb([
        storedOMDoc({ id: 'g0', supersededBy: 'g1', bufferedObservationChunks: JSON.stringify([serializedChunk()]) }),
        storedOMDoc({ id: 'g1', generationCount: 1 }),
      ]);

      const result = await run(ctx, {
        op: 'omSwapBuffered',
        id: 'g0',
        activationRatio: 1,
        messageTokensThreshold: 1000,
        currentPendingTokens: 1000,
        now: NOW,
      });

      expect(result.result).toMatchObject({ chunksActivated: 0, retired: true });
      expect(db.patch).not.toHaveBeenCalled();
    });

    it('keeps a chunk appended after the caller read the record', async () => {
      const chunkA = serializedChunk({ id: 'c-a', cycleId: 'a', messageTokens: 1000 });
      const chunkB = serializedChunk({
        id: 'c-b',
        cycleId: 'b',
        messageTokens: 1000,
        lastObservedAt: '2026-06-01T02:00:00.000Z',
      });
      const { ctx, docs } = createFakeOMDb([
        storedOMDoc({ bufferedObservationChunks: JSON.stringify([chunkA, chunkB]) }),
      ]);

      // The caller only saw chunk A (with a refreshed weight).
      const result = await run(ctx, {
        op: 'omSwapBuffered',
        id: 'om-1',
        activationRatio: 1,
        messageTokensThreshold: 1000,
        currentPendingTokens: 1000,
        bufferedChunks: [{ ...chunkA, messageTokens: 900 }],
        now: NOW,
      });

      expect(result.result.activatedCycleIds).toEqual(['a']);
      // The remaining chunk is the stored one, unmodified.
      expect(parseStoredChunks(docs[0]!.bufferedObservationChunks)).toEqual([chunkB]);
    });

    it('never moves the cursor backward', async () => {
      const { ctx, docs } = createFakeOMDb([
        storedOMDoc({
          lastObservedAt: '2026-06-03T00:00:00.000Z',
          bufferedObservationChunks: JSON.stringify([serializedChunk({ lastObservedAt: '2026-06-01T01:00:00.000Z' })]),
        }),
      ]);

      await run(ctx, {
        op: 'omSwapBuffered',
        id: 'om-1',
        activationRatio: 1,
        messageTokensThreshold: 1000,
        currentPendingTokens: 1000,
        now: NOW,
      });

      expect(docs[0]!.lastObservedAt).toBe('2026-06-03T00:00:00.000Z');
    });
  });

  describe('omUpdateActive', () => {
    it('rejects a commit built from stale text without writing', async () => {
      const { ctx, db } = createFakeOMDb([storedOMDoc({ activeObservations: 'current' })]);

      const result = await run(ctx, {
        op: 'omUpdateActive',
        id: 'om-1',
        observations: 'stale + new',
        tokenCount: 1,
        lastObservedAt: NOW,
        observedMessageIds: null,
        updatedAt: NOW,
        expectedActiveObservations: 'stale',
      });

      expect(result.result).toEqual({ applied: false, reason: 'conflict' });
      expect(db.patch).not.toHaveBeenCalled();
    });

    it('never moves the cursor backward', async () => {
      const { ctx, docs } = createFakeOMDb([storedOMDoc({ lastObservedAt: '2026-06-03T00:00:00.000Z' })]);

      await run(ctx, {
        op: 'omUpdateActive',
        id: 'om-1',
        observations: 'x',
        tokenCount: 1,
        lastObservedAt: '2026-06-02T00:00:00.000Z',
        observedMessageIds: null,
        updatedAt: NOW,
        expectedActiveObservations: '',
      });

      expect(docs[0]).toMatchObject({ activeObservations: 'x', lastObservedAt: '2026-06-03T00:00:00.000Z' });
    });
  });

  it('flag and counter writes aimed at a retired generation land on the head', async () => {
    const { ctx, docs } = createFakeOMDb([
      storedOMDoc({ id: 'g0', supersededBy: 'g1' }),
      storedOMDoc({ id: 'g1', generationCount: 1 }),
    ]);

    await run(ctx, { op: 'omSetPendingMessageTokens', id: 'g0', tokenCount: 42, updatedAt: NOW });
    await run(ctx, {
      op: 'omSetBufferingObservationFlag',
      id: 'g0',
      isBuffering: true,
      lastBufferedAtTokens: 7,
      updatedAt: NOW,
    });

    expect(byId(docs, 'g1')).toMatchObject({
      pendingMessageTokens: 42,
      isBufferingObservation: true,
      lastBufferedAtTokens: 7,
    });
    expect(byId(docs, 'g0')).toMatchObject({ pendingMessageTokens: 0, isBufferingObservation: false });
  });
});
