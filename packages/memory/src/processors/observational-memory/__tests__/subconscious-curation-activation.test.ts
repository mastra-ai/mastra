import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationTurn } from '../observation-turn/turn';

/**
 * The turn/step lifecycle owns no curation. Activation and end-of-turn used to launch
 * `maybeCurate` directly (racing the idle buffer — the bug this rework fixes); curation is now
 * driven solely by the pipeline-completion callback wired at the Subconscious config layer.
 *
 * The fake OM below deliberately has NO curation surface at all: if any turn/step path still
 * tried to launch curation, it would throw on the missing method and fail these tests.
 */

function record(): ObservationalMemoryRecord {
  return {
    id: 'record-1',
    threadId: 'thread-1',
    activeObservations: null,
    observationTokenCount: 0,
    lastObservedAt: null,
    generationCount: 0,
    bufferedObservationChunks: null,
    isBufferingObservation: false,
    lastBufferedAt: null,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ObservationalMemoryRecord;
}

function harness() {
  const current = record();
  const om = {
    activate: vi.fn(async () => ({ activated: true, record: current, activatedMessageIds: [] })),
    resetBufferingState: vi.fn(async () => {}),
    getOrCreateRecord: vi.fn(async () => current),
    reflector: { maybeReflect: vi.fn(async () => {}) },
    composeHooks: vi.fn(() => ({})),
    getStatus: vi.fn(async () => ({ shouldObserve: true, canActivate: true, record: current })),
    waitForBuffering: vi.fn(async () => {}),
    buffering: { isAsyncObservationEnabled: vi.fn(() => false) },
    getObservationConfig: vi.fn(() => ({ bufferOnIdle: false })),
    trackBackgroundWork: vi.fn(<T>(work: Promise<T>) => work),
    scope: 'thread',
  };
  const messageList = {
    get: {
      all: { db: () => [] },
      input: { db: () => [] },
      response: { db: () => [] },
    },
    makeMessageSourceChecker: vi.fn(() => ({ context: new Set() })),
    removeByIds: vi.fn(),
    add: vi.fn(),
  };
  const requestContext = { get: vi.fn() };
  const turn = new ObservationTurn({
    om: om as any,
    threadId: 'thread-1',
    resourceId: 'resource-1',
    messageList: messageList as any,
    requestContext: requestContext as any,
  });
  return { om, turn };
}

describe('turn/step lifecycle owns no curation', () => {
  it('step-0 activation completes without launching curation', async () => {
    const { om, turn } = harness();
    await turn.start();
    om.reflector.maybeReflect.mockRejectedValueOnce(new Error('stop after activation'));

    // Reaches maybeReflect (i.e. past the point where activation used to launch curation)
    // against an OM with zero curation surface — a leftover call site would throw earlier.
    await expect(turn.step(0).prepare()).rejects.toThrow('stop after activation');
    expect(om.activate).toHaveBeenCalled();
  });

  it('threshold-path activation completes without launching curation', async () => {
    const { om, turn } = harness();
    await turn.start();
    const step = turn.step(1);

    const result = await (step as any).runThresholdObservation();

    expect(result.succeeded).toBe(true);
    expect(om.activate).toHaveBeenCalled();
  });

  it('turn.end() launches nothing beyond idle buffering (the old racy curation launch is gone)', async () => {
    const { om, turn } = harness();
    await turn.start();

    const result = await turn.end();

    expect(result.record).toBeTruthy();
    // No background work was launched at all: buffering disabled, and no curation call exists.
    expect(om.trackBackgroundWork).not.toHaveBeenCalled();
  });
});
