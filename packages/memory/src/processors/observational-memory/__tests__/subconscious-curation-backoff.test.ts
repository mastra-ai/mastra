import { RequestContext } from '@mastra/core/request-context';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import {
  CURATION_BACKOFF_BASE_MS,
  CURATION_BACKOFF_CAP_MS,
  clearedBackoff,
  isBackingOff,
  nextBackoff,
  readAttemptState,
} from '../subconscious/curation-backoff';
import { createCurationEvaluator } from '../subconscious/curation-runtime';

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

type CurationOutcome = 'ran' | 'no-op' | 'skipped' | 'no-model';

function stubMemory(initialOutcome: CurationOutcome, uncurated = 5, advanceCursor = true) {
  let outcome = initialOutcome;
  let cursor: { lastKnowledgeId: string } | null = null;
  const runCuration = vi.fn(async () => {
    if (outcome === 'ran' && advanceCursor) cursor = { lastKnowledgeId: `k-${uncurated - 1}` };
    return { outcome };
  });
  return {
    runCuration,
    setOutcome(next: CurationOutcome) {
      outcome = next;
    },
    storage: {
      getStore: async (domain: string) =>
        domain === 'knowledge'
          ? {
              getCurationCursor: async () => cursor,
              knowledgeBySource: async ({ limit }: { limit?: number }) => ({
                records: Array.from({ length: Math.min(uncurated, limit ?? uncurated) }, (_, i) => ({ id: `k-${i}` })),
                nextCursor: undefined,
              }),
            }
          : undefined,
    },
  };
}

/**
 * The backoff lifecycle now lives in the curator runtime: the evaluator persists attempt state
 * onto the OM record's config and honours it across evaluations — OM itself knows nothing.
 * Shared storage lets a second evaluator stand in for the same deployment after a restart.
 */
function createEvaluator(memory: unknown, now: () => number, storage = new InMemoryMemory({ db: new InMemoryDB() })) {
  const evaluator = createCurationEvaluator(
    { placement: 'observation', trigger: { uncuratedRecords: 3, maxAgeMs: false } },
    {
      memory: memory as any,
      getRecord: (threadId, resourceId) => storage.getObservationalMemory(threadId, resourceId ?? threadId),
      updateRecordConfig: (recordId, config) => storage.updateObservationalMemoryConfig({ id: recordId, config }),
      now,
    },
  )!;
  return { evaluator, storage };
}

async function seedRecord(storage: InMemoryMemory, threadId: string) {
  return storage.initializeObservationalMemory({ threadId, resourceId: threadId, scope: 'thread', config: {} });
}

describe('curation backoff state', () => {
  it('grows exponentially from one minute and caps at one hour', () => {
    let state = nextBackoff(undefined, 0);
    expect(state).toEqual({ failures: 1, nextAttemptAt: CURATION_BACKOFF_BASE_MS });

    state = nextBackoff(state, 0);
    expect(state.nextAttemptAt).toBe(CURATION_BACKOFF_BASE_MS * 2);

    for (let i = 0; i < 20; i++) state = nextBackoff(state, 0);
    expect(state.nextAttemptAt).toBe(CURATION_BACKOFF_CAP_MS);
  });

  it('reports backing off only inside the window', () => {
    const state = { failures: 1, nextAttemptAt: 1_000 };
    expect(isBackingOff(state, 999)).toBe(true);
    expect(isBackingOff(state, 1_000)).toBe(false);
    expect(isBackingOff(clearedBackoff(), 0)).toBe(false);
    expect(isBackingOff(undefined, 0)).toBe(false);
  });

  it('tolerates absent or malformed persisted state', () => {
    expect(readAttemptState(undefined)).toBeUndefined();
    expect(readAttemptState({})).toBeUndefined();
    expect(readAttemptState({ subconscious: { curationAttempt: { failures: 'lots' } } })).toBeUndefined();
    expect(readAttemptState({ subconscious: { curationAttempt: { failures: 2, nextAttemptAt: 5 } } })).toEqual({
      failures: 2,
      nextAttemptAt: 5,
    });
  });
});

describe('curation backoff in the evaluator lifecycle', () => {
  it('does not retry a failed curation on the very next evaluation', async () => {
    const memory = stubMemory('no-model');
    let now = 1_000_000;
    const { evaluator, storage } = createEvaluator(memory, () => now);
    const threadId = 'failing-thread';
    await seedRecord(storage, threadId);

    await evaluator.evaluate({ threadId, requestContext: requestContext() });
    expect(memory.runCuration).toHaveBeenCalledTimes(1);

    // Same minute: still inside the backoff window.
    now += 30_000;
    await evaluator.evaluate({ threadId, requestContext: requestContext() });
    expect(memory.runCuration).toHaveBeenCalledTimes(1);

    // Past the window: allowed to try again.
    now += CURATION_BACKOFF_BASE_MS;
    await evaluator.evaluate({ threadId, requestContext: requestContext() });
    expect(memory.runCuration).toHaveBeenCalledTimes(2);
  });

  it('survives a restart — a fresh evaluator still honours the persisted backoff', async () => {
    const memory = stubMemory('no-model');
    const now = 2_000_000;
    const { evaluator, storage } = createEvaluator(memory, () => now);
    const threadId = 'restart-thread';
    await seedRecord(storage, threadId);

    await evaluator.evaluate({ threadId, requestContext: requestContext() });
    expect(memory.runCuration).toHaveBeenCalledTimes(1);

    // A new evaluator over the same storage is what a redeploy looks like.
    const restarted = createEvaluator(memory, () => now + 30_000, storage).evaluator;
    await restarted.evaluate({ threadId, requestContext: requestContext() });

    expect(memory.runCuration).toHaveBeenCalledTimes(1);
  });

  it('clears the backoff after a successful curation', async () => {
    const memory = stubMemory('no-model');
    let now = 3_000_000;
    const { evaluator, storage } = createEvaluator(memory, () => now);
    const threadId = 'recovering-thread';
    await seedRecord(storage, threadId);

    await evaluator.evaluate({ threadId, requestContext: requestContext() });

    memory.setOutcome('ran');
    now += CURATION_BACKOFF_BASE_MS;
    await evaluator.evaluate({ threadId, requestContext: requestContext() });

    const after = await storage.getObservationalMemory(threadId, threadId);
    expect(readAttemptState(after?.config)).toEqual({ failures: 0, nextAttemptAt: 0 });
  });

  it('leaves backoff state untouched when the curator skips', async () => {
    const memory = stubMemory('skipped');
    const now = 4_000_000;
    const { evaluator, storage } = createEvaluator(memory, () => now);
    const threadId = 'skipping-thread';
    await seedRecord(storage, threadId);

    await evaluator.evaluate({ threadId, requestContext: requestContext() });

    const record = await storage.getObservationalMemory(threadId, threadId);
    expect(memory.runCuration).toHaveBeenCalledTimes(1);
    expect(readAttemptState(record?.config)).toBeUndefined();
  });

  it('backs off when the curator reports ran without advancing the cursor', async () => {
    const memory = stubMemory('ran', 5, false);
    const now = 4_500_000;
    const { evaluator, storage } = createEvaluator(memory, () => now);
    const threadId = 'no-progress-thread';
    await seedRecord(storage, threadId);

    await evaluator.evaluate({ threadId, requestContext: requestContext() });

    const after = await storage.getObservationalMemory(threadId, threadId);
    expect(readAttemptState(after?.config)).toEqual({
      failures: 1,
      nextAttemptAt: now + CURATION_BACKOFF_BASE_MS,
    });
  });

  it('backs off when the curator throws, and rethrows to the caller', async () => {
    const memory = stubMemory('ran');
    memory.runCuration.mockRejectedValue(new Error('curator exploded'));
    const now = 5_000_000;
    const { evaluator, storage } = createEvaluator(memory, () => now);
    const threadId = 'throwing-thread';
    await seedRecord(storage, threadId);

    await expect(evaluator.evaluate({ threadId, requestContext: requestContext() })).rejects.toThrow(
      'curator exploded',
    );

    const after = await storage.getObservationalMemory(threadId, threadId);
    expect(readAttemptState(after?.config)).toEqual({
      failures: 1,
      nextAttemptAt: now + CURATION_BACKOFF_BASE_MS,
    });
  });
});
