import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationTurn } from '../observation-turn/turn';

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
  const maybeCurate = vi.fn(async () => {});
  const om = {
    activate: vi.fn(async () => ({ activated: true, record: current, activatedMessageIds: [] })),
    resetBufferingState: vi.fn(async () => {}),
    getOrCreateRecord: vi.fn(async () => current),
    maybeCurate,
    reflector: { maybeReflect: vi.fn(async () => {}) },
    composeHooks: vi.fn(() => ({})),
    getStatus: vi.fn(async () => ({ shouldObserve: true, canActivate: true, record: current })),
    waitForBuffering: vi.fn(async () => {}),
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
  return { om, maybeCurate, requestContext, turn };
}

describe('curation evaluation after activation', () => {
  it('evaluates after step-0 activation', async () => {
    const { om, maybeCurate, requestContext, turn } = harness();
    await turn.start();
    om.reflector.maybeReflect.mockRejectedValueOnce(new Error('stop after activation'));

    await expect(turn.step(0).prepare()).rejects.toThrow('stop after activation');

    expect(maybeCurate).toHaveBeenCalledWith('thread-1', 'resource-1', expect.any(Object), requestContext);
  });

  it('evaluates after threshold-path activation', async () => {
    const { maybeCurate, requestContext, turn } = harness();
    await turn.start();
    const step = turn.step(1);

    const result = await (step as any).runThresholdObservation();

    expect(result.succeeded).toBe(true);
    expect(maybeCurate).toHaveBeenCalledWith('thread-1', 'resource-1', expect.any(Object), requestContext);
  });
});
