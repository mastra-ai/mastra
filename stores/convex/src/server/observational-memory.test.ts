import type { GenericId } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';

import type { SerializedOMChunk, StorageRequest, StorageResponse } from '../storage/types';
import {
  deepMergeOMConfig,
  handleObservationalMemoryOperation,
  mergeReflectionWithUnreflected,
  parseStoredChunks,
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
 * Emulates by_record_id (eq id) and by_lookup_key (eq lookupKey, sorted by
 * generationCount with .order() control) index semantics.
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
          const eqPairs: Array<[string, unknown]> = [];
          const builder = {
            eq: (field: string, value: unknown) => {
              eqPairs.push([field, value]);
              return builder;
            },
          };
          queryBuilder?.(builder);
          filtered = filtered.filter(doc => eqPairs.every(([field, value]) => doc[field] === value));
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

    expect(result).toEqual({ ok: true });
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
