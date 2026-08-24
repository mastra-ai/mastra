import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { nextBackoff } from '../subconscious/curation-backoff';
import { createCurationEvaluator } from '../subconscious/curation-runtime';
import type { CurationEvaluatorDeps } from '../subconscious/curation-runtime';
import { curationQueryLimit, shouldCurate, type CurationTriggerConfig } from '../subconscious/curation-trigger';

const OFF: CurationTriggerConfig = { curationThreshold: false, curationMaxAgeMs: false };
const NOW = Date.parse('2026-08-21T19:00:00.000Z');
const cursorAgedMs = (ms: number) => ({ updatedAt: new Date(NOW - ms) });

describe('shouldCurate', () => {
  it('does not fire when the threshold is not met', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationThreshold: 10 },
        cursor: cursorAgedMs(0),
        newRecordCount: 9,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('fires on threshold when it is met exactly', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationThreshold: 10 },
        cursor: cursorAgedMs(0),
        newRecordCount: 10,
        now: NOW,
      }),
    ).toBe('threshold');
  });

  it('fires on threshold when it is overshot', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationThreshold: 10 },
        cursor: cursorAgedMs(0),
        newRecordCount: 25,
        now: NOW,
      }),
    ).toBe('threshold');
  });

  it('fires on age when the cursor is stale and at least one record is uncurated', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationMaxAgeMs: 60_000 },
        cursor: cursorAgedMs(60_001),
        newRecordCount: 1,
        now: NOW,
      }),
    ).toBe('age');
  });

  it('does NOT fire on age when there is no uncurated work', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationMaxAgeMs: 60_000 },
        cursor: cursorAgedMs(10 * 60_000),
        newRecordCount: 0,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('does not fire on age before the threshold age has elapsed', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationMaxAgeMs: 60_000 },
        cursor: cursorAgedMs(59_999),
        newRecordCount: 5,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('never fires with both conditions off (the defaults)', () => {
    expect(shouldCurate({ config: OFF, cursor: cursorAgedMs(10 * 60_000), newRecordCount: 500, now: NOW })).toBeNull();
  });

  it('fires on volume when no cursor exists yet', () => {
    expect(
      shouldCurate({
        config: { curationThreshold: 3, curationMaxAgeMs: 60_000 },
        cursor: null,
        newRecordCount: 3,
        now: NOW,
      }),
    ).toBe('threshold');
  });

  it('does not fire on age when no cursor exists, since there is no age baseline', () => {
    expect(
      shouldCurate({
        config: { curationThreshold: 10, curationMaxAgeMs: 1 },
        cursor: null,
        newRecordCount: 9,
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe('curationQueryLimit', () => {
  it('uses the threshold as the query limit when one is configured', () => {
    expect(curationQueryLimit({ ...OFF, curationThreshold: 25 })).toBe(25);
  });

  it('uses a limit of 1 for an age-only configuration', () => {
    expect(curationQueryLimit({ ...OFF, curationMaxAgeMs: 60_000 })).toBe(1);
  });

  it('reports 0 when both conditions are off so the caller can skip the query', () => {
    expect(curationQueryLimit(OFF)).toBe(0);
  });
});

describe('createCurationEvaluator', () => {
  const record = { id: 'record-1', config: {} } as any;

  function requestContext() {
    const context = new RequestContext();
    context.set('organizationId', 'acme');
    return context;
  }

  function fakeDeps(overrides?: {
    records?: number;
    cursor?: { lastKnowledgeId: string; updatedAt: Date } | null;
    cursorAfter?: { lastKnowledgeId: string; updatedAt: Date } | null;
    outcome?: 'ran' | 'no-op' | 'skipped' | 'no-model';
    runCuration?: () => Promise<{ outcome: 'ran' | 'no-op' | 'skipped' | 'no-model' }>;
    recordConfig?: unknown;
  }) {
    const cursor = overrides?.cursor === undefined ? null : overrides.cursor;
    const cursorAfter = overrides?.cursorAfter === undefined ? cursor : overrides.cursorAfter;
    let cursorReads = 0;
    const store = {
      getCurationCursor: vi.fn(async () => (cursorReads++ === 0 ? cursor : cursorAfter)),
      knowledgeBySource: vi.fn(async ({ limit }: { limit: number }) => ({
        records: Array.from({ length: Math.min(overrides?.records ?? 0, limit) }, (_, i) => ({ id: `k-${i}` })),
        nextCursor: undefined,
      })),
    };
    const runCuration = vi.fn(
      overrides?.runCuration ?? (async () => ({ outcome: overrides?.outcome ?? ('ran' as const) })),
    );
    const updateRecordConfig = vi.fn(async () => {});
    const deps: CurationEvaluatorDeps = {
      memory: { storage: { getStore: async () => store }, runCuration } as any,
      getRecord: vi.fn(async () => ({ ...record, config: overrides?.recordConfig ?? {} })),
      updateRecordConfig,
      now: () => NOW,
    };
    return { deps, store, runCuration, updateRecordConfig };
  }

  const CURATION = { placement: 'observation' as const, trigger: { uncuratedRecords: 3, maxAgeMs: false as const } };

  it('returns null when there is no trigger to evaluate', () => {
    const { deps } = fakeDeps();
    expect(createCurationEvaluator(null, deps)).toBeNull();
    expect(createCurationEvaluator({ placement: 'reflection', trigger: null }, deps)).toBeNull();
    expect(
      createCurationEvaluator({ placement: 'reflection', trigger: { uncuratedRecords: false, maxAgeMs: false } }, deps),
    ).toBeNull();
  });

  it('runs the curator when the volume threshold is met', async () => {
    const { deps, store, runCuration } = fakeDeps({
      records: 3,
      cursor: null,
      cursorAfter: { lastKnowledgeId: 'k-2', updatedAt: new Date(NOW) },
    });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() });

    expect(store.knowledgeBySource).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    expect(runCuration).toHaveBeenCalledWith(expect.objectContaining({ threadId: 'thread-1', resourceId: 'user-1' }));
  });

  it('does not run the curator below the threshold', async () => {
    const { deps, runCuration } = fakeDeps({ records: 2 });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() });
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('does nothing without an organizationId in the request context', async () => {
    const { deps, store, runCuration } = fakeDeps({ records: 3 });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({
      threadId: 'thread-1',
      resourceId: 'user-1',
      record,
      requestContext: new RequestContext(),
    });
    expect(store.knowledgeBySource).not.toHaveBeenCalled();
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('respects persisted backoff state and skips the query entirely', async () => {
    const { deps, store, runCuration } = fakeDeps({
      records: 3,
      recordConfig: { subconscious: { curationAttempt: nextBackoff(undefined, NOW) } },
    });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() });
    expect(store.knowledgeBySource).not.toHaveBeenCalled();
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('persists backoff when the curator throws, and rethrows', async () => {
    const { deps, updateRecordConfig } = fakeDeps({
      records: 3,
      runCuration: async () => {
        throw new Error('boom');
      },
    });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await expect(
      evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() }),
    ).rejects.toThrow('boom');
    expect(updateRecordConfig).toHaveBeenCalledWith(
      'record-1',
      expect.objectContaining({ subconscious: { curationAttempt: expect.objectContaining({ failures: 1 }) } }),
    );
  });

  it('persists backoff when the curator ran but the cursor did not advance', async () => {
    const stale = { lastKnowledgeId: 'k-0', updatedAt: new Date(NOW) };
    const { deps, updateRecordConfig } = fakeDeps({ records: 3, cursor: stale, cursorAfter: stale, outcome: 'ran' });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() });
    expect(updateRecordConfig).toHaveBeenCalledWith(
      'record-1',
      expect.objectContaining({ subconscious: { curationAttempt: expect.objectContaining({ failures: 1 }) } }),
    );
  });

  it('leaves backoff untouched on a skipped outcome', async () => {
    const { deps, updateRecordConfig } = fakeDeps({ records: 3, outcome: 'skipped' });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() });
    expect(updateRecordConfig).not.toHaveBeenCalled();
  });

  it('clears persisted failures after a successful, cursor-advancing run', async () => {
    const { deps, updateRecordConfig } = fakeDeps({
      records: 3,
      cursor: { lastKnowledgeId: 'k-0', updatedAt: new Date(NOW) },
      cursorAfter: { lastKnowledgeId: 'k-2', updatedAt: new Date(NOW) },
      outcome: 'ran',
      recordConfig: { subconscious: { curationAttempt: { failures: 2, nextAttemptAt: 0 } } },
    });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    await evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: requestContext() });
    expect(updateRecordConfig).toHaveBeenCalledWith(
      'record-1',
      expect.objectContaining({ subconscious: { curationAttempt: { failures: 0, nextAttemptAt: 0 } } }),
    );
  });

  it('serializes evaluations per record so concurrent completion sites cannot both run', async () => {
    const order: string[] = [];
    const { deps } = fakeDeps({
      records: 3,
      runCuration: async () => {
        order.push('run-start');
        await new Promise(resolve => setTimeout(resolve, 0));
        order.push('run-end');
        return { outcome: 'ran' as const };
      },
    });
    const evaluator = createCurationEvaluator(CURATION, deps)!;
    const context = requestContext();
    await Promise.all([
      evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: context }),
      evaluator.evaluate({ threadId: 'thread-1', resourceId: 'user-1', record, requestContext: context }),
    ]);
    // Runs never interleave: every run-start is followed by its own run-end.
    expect(order).toEqual(['run-start', 'run-end', 'run-start', 'run-end']);
  });
});
