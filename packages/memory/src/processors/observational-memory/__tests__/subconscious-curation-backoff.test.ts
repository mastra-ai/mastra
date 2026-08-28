import { RequestContext } from '@mastra/core/request-context';
import { knowledgeScopeKey } from '@mastra/core/storage';
import type { KnowledgeCurationLane, KnowledgeCurationState } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import {
  CURATION_BACKOFF_BASE_MS,
  CURATION_BACKOFF_CAP_MS,
  isBackingOff,
  nextBackoff,
} from '../subconscious/curation-backoff';
import { createCurationEvaluator } from '../subconscious/curation-runtime';

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

const lane: KnowledgeCurationLane = {
  scope: ['org:acme', 'resource:user-1', 'thread:thread-1'],
  sourceThreadId: 'thread-1',
  agent: 'subconscious:curate',
};

function key(input: KnowledgeCurationLane) {
  return `${knowledgeScopeKey(input.scope)}:${input.sourceThreadId}:${input.agent}`;
}

function createHarness({ capable = true, outcome = 'no-model', advance = false } = {}) {
  const states = new Map<string, KnowledgeCurationState>();
  const cursors = new Map<string, { lastKnowledgeId: string; updatedAt: Date }>();
  let currentOutcome: 'ran' | 'no-op' | 'skipped' | 'no-model' = outcome as typeof currentOutcome;
  let shouldAdvance = advance;

  const store = {
    supportsCurationState: capable,
    getCurationState: vi.fn(async (input: KnowledgeCurationLane) => states.get(key(input)) ?? null),
    upsertCurationState: vi.fn(async (state: KnowledgeCurationState) => {
      states.set(key(state), state);
      return state;
    }),
    clearCurationState: vi.fn(async (input: KnowledgeCurationLane) => {
      states.delete(key(input));
    }),
    getCurationCursor: vi.fn(
      async ({ sourceThreadId }: { sourceThreadId: string }) => cursors.get(sourceThreadId) ?? null,
    ),
    knowledgeBySource: vi.fn(async () => ({
      records: [{ id: 'k-1' }, { id: 'k-2' }, { id: 'k-3' }],
      nextCursor: undefined,
    })),
  };
  const runCuration = vi.fn(async ({ threadId }: { threadId: string }) => {
    if (currentOutcome === 'ran' && shouldAdvance) {
      cursors.set(threadId, { lastKnowledgeId: `advanced-${threadId}`, updatedAt: new Date() });
    }
    return { outcome: currentOutcome };
  });
  const memory = { runCuration, storage: { getStore: async () => store } };

  return {
    memory,
    store,
    states,
    runCuration,
    setOutcome(next: typeof currentOutcome, nextAdvance = shouldAdvance) {
      currentOutcome = next;
      shouldAdvance = nextAdvance;
    },
  };
}

function evaluator(memory: unknown, now: () => number) {
  return createCurationEvaluator(
    { placement: 'observation', trigger: { uncuratedRecords: 3, maxAgeMs: false } },
    { memory: memory as any, now },
  )!;
}

describe('curation backoff state', () => {
  it('grows exponentially from one minute and caps at one hour', () => {
    let state = nextBackoff(lane, undefined, 'no-model', 0);
    expect(state.failures).toBe(1);
    expect(state.nextEligibleAt.getTime()).toBe(CURATION_BACKOFF_BASE_MS);

    state = nextBackoff(lane, state, 'no-model', 0);
    expect(state.nextEligibleAt.getTime()).toBe(CURATION_BACKOFF_BASE_MS * 2);

    for (let i = 0; i < 20; i++) state = nextBackoff(lane, state, 'no-model', 0);
    expect(state.nextEligibleAt.getTime()).toBe(CURATION_BACKOFF_CAP_MS);
  });

  it('reports backing off only inside the window', () => {
    const state = nextBackoff(lane, undefined, 'no-op', 0);
    expect(isBackingOff(state, CURATION_BACKOFF_BASE_MS - 1)).toBe(true);
    expect(isBackingOff(state, CURATION_BACKOFF_BASE_MS)).toBe(false);
    expect(isBackingOff(undefined, 0)).toBe(false);
  });
});

describe.each([
  ['durable storage', true],
  ['compatibility fallback', false],
] as const)('curation evaluator with %s', (_name, capable) => {
  it.each(['no-model', 'no-op'] as const)('backs off after %s and retries after expiry', async outcome => {
    const harness = createHarness({ capable, outcome });
    let currentTime = 1_000_000;
    const instance = evaluator(harness.memory, () => currentTime);
    const options = { threadId: 'thread-1', resourceId: 'user-1', requestContext: requestContext() };

    await instance.evaluate(options);
    await instance.evaluate(options);
    expect(harness.runCuration).toHaveBeenCalledTimes(1);

    currentTime += CURATION_BACKOFF_BASE_MS;
    await instance.evaluate(options);
    expect(harness.runCuration).toHaveBeenCalledTimes(2);
  });

  it('backs off when ran does not advance and clears state after acknowledged progress', async () => {
    const harness = createHarness({ capable, outcome: 'ran', advance: false });
    let currentTime = 2_000_000;
    const instance = evaluator(harness.memory, () => currentTime);
    const options = { threadId: 'thread-1', resourceId: 'user-1', requestContext: requestContext() };

    await instance.evaluate(options);
    await instance.evaluate(options);
    expect(harness.runCuration).toHaveBeenCalledTimes(1);

    harness.setOutcome('ran', true);
    currentTime += CURATION_BACKOFF_BASE_MS;
    await instance.evaluate(options);

    if (capable) expect(harness.states.size).toBe(0);
    expect(harness.runCuration).toHaveBeenCalledTimes(2);
  });

  it('keeps skipped neutral', async () => {
    const harness = createHarness({ capable, outcome: 'skipped' });
    await evaluator(harness.memory, () => 3_000_000).evaluate({
      threadId: 'thread-1',
      resourceId: 'user-1',
      requestContext: requestContext(),
    });

    expect(harness.store.upsertCurationState).not.toHaveBeenCalled();
    expect(harness.store.clearCurationState).not.toHaveBeenCalled();
  });
});

describe('durable and compatibility behavior', () => {
  it('survives evaluator restart with capable storage', async () => {
    const harness = createHarness({ capable: true, outcome: 'no-model' });
    const options = { threadId: 'thread-1', resourceId: 'user-1', requestContext: requestContext() };
    await evaluator(harness.memory, () => 4_000_000).evaluate(options);
    await evaluator(harness.memory, () => 4_030_000).evaluate(options);
    expect(harness.runCuration).toHaveBeenCalledTimes(1);
  });

  it('uses a process-local fallback, warns once, and never calls unsupported state methods', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = createHarness({ capable: false, outcome: 'no-model' });
    const instance = evaluator(harness.memory, () => 5_000_000);
    const options = { threadId: 'thread-1', resourceId: 'user-1', requestContext: requestContext() };

    await instance.evaluate(options);
    await instance.evaluate(options);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(harness.store.getCurationState).not.toHaveBeenCalled();
    expect(harness.store.upsertCurationState).not.toHaveBeenCalled();
    expect(harness.store.clearCurationState).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('isolates resource-shared source threads by the full lane key', async () => {
    const harness = createHarness({ capable: true, outcome: 'no-model' });
    const instance = evaluator(harness.memory, () => 6_000_000);

    await instance.evaluate({ threadId: 'thread-a', resourceId: 'shared', requestContext: requestContext() });
    await instance.evaluate({ threadId: 'thread-b', resourceId: 'shared', requestContext: requestContext() });

    expect(harness.runCuration).toHaveBeenCalledTimes(2);
    expect(harness.states.size).toBe(2);
  });

  it('records thrown curator failures without escaping the evaluator', async () => {
    const harness = createHarness({ capable: true });
    harness.runCuration.mockRejectedValueOnce(new Error('provider exploded'));

    await expect(
      evaluator(harness.memory, () => 7_000_000).evaluate({
        threadId: 'thread-1',
        resourceId: 'user-1',
        requestContext: requestContext(),
      }),
    ).resolves.toBeUndefined();
    expect([...harness.states.values()][0]?.lastOutcome).toBe('error');
  });

  it('forwards a reflection prompt unchanged through the shared executor', async () => {
    const harness = createHarness({ capable: true, outcome: 'no-op' });
    const prompt = '<observations>reflection payload</observations>';
    await evaluator(harness.memory, () => 8_000_000).evaluate({
      threadId: 'thread-1',
      resourceId: 'user-1',
      requestContext: requestContext(),
      prompt,
    });

    expect(harness.runCuration).toHaveBeenCalledWith(expect.objectContaining({ prompt }));
  });

  it('surfaces durable state persistence failures', async () => {
    const harness = createHarness({ capable: true, outcome: 'no-model' });
    harness.store.upsertCurationState.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      evaluator(harness.memory, () => 9_000_000).evaluate({
        threadId: 'thread-1',
        resourceId: 'user-1',
        requestContext: requestContext(),
      }),
    ).rejects.toThrow('storage unavailable');
  });
});
