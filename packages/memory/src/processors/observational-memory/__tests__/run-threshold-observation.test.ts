/**
 * runThresholdObservation regression tests (issue #19767).
 *
 * Partial buffered activation must not return success while the live unobserved
 * tail is still above the observation threshold.
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ObservationStep } from '../observation-turn/step';
import { ObservationTurn } from '../observation-turn/turn';

function createTestMessage(id: string): MastraDBMessage {
  return {
    id,
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text: `message ${id}`, createdAt: Date.now() }],
    } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  };
}

function createMockRecord(): ObservationalMemoryRecord {
  return {
    id: 'rec-threshold',
    threadId: 'threshold-thread',
    resourceId: 'threshold-resource',
    scope: 'thread',
    originType: 'initial',
    activeObservations: '',
    observationTokenCount: 0,
    totalTokensObserved: 0,
    pendingMessageTokens: 0,
    generationCount: 0,
    bufferedObservationChunks: [],
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    observedMessageIds: [],
  };
}

function createStatus(
  record: ObservationalMemoryRecord,
  overrides?: { shouldObserve?: boolean; canActivate?: boolean; pendingTokens?: number },
) {
  return {
    record,
    pendingTokens: overrides?.pendingTokens ?? 80_000,
    threshold: 10_000,
    effectiveObservationTokensThreshold: 50_000,
    shouldObserve: overrides?.shouldObserve ?? true,
    shouldBuffer: false,
    shouldReflect: false,
    canActivate: overrides?.canActivate ?? true,
    asyncObservationEnabled: true,
  };
}

function createMockOM(record: ObservationalMemoryRecord) {
  const observe = vi.fn(async () => ({
    observed: true,
    record: { ...record, observedMessageIds: ['live-msg-1', 'live-msg-2'] },
  }));
  const activate = vi.fn(async () => ({
    activated: true,
    record,
    activatedMessageIds: ['chunk-msg-1'],
  }));

  const getStatus = vi
    .fn()
    .mockResolvedValueOnce(createStatus(record))
    .mockResolvedValueOnce(createStatus(record, { shouldObserve: true, canActivate: false, pendingTokens: 75_000 }));

  return {
    waitForBuffering: vi.fn(async () => {}),
    getStatus,
    activate,
    observe,
    reflector: {
      maybeReflect: vi.fn(async () => {}),
    },
    observer: {
      lastExchange: { prompt: 'observer-prompt', response: 'observer-response' },
    },
    composeHooks: vi.fn(() => undefined),
    sealMessagesForBuffering: vi.fn(),
    persistMessages: vi.fn(async () => {}),
    getObservationConfig: vi.fn(() => ({ bufferActivation: 0.7 })),
  };
}

function createTurn(mockOM: ReturnType<typeof createMockOM>, messages: MastraDBMessage[]) {
  const messageList = {
    get: {
      all: { db: () => messages },
      input: { db: () => [] as MastraDBMessage[] },
      response: { db: () => [] as MastraDBMessage[] },
    },
    makeMessageSourceChecker: () => ({ context: new Set<string>() }),
  };

  const turn = new ObservationTurn({
    om: mockOM as any,
    threadId: 'threshold-thread',
    resourceId: 'threshold-resource',
    messageList: messageList as any,
    sendSignal: vi.fn(),
    requestContext: { get: vi.fn() } as any,
  });

  (turn as any)._record = createMockRecord();
  return turn;
}

describe('runThresholdObservation partial activation', () => {
  const threadId = 'threshold-thread';
  const resourceId = 'threshold-resource';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Regression: https://github.com/mastra-ai/mastra/issues/19767
  it('falls through to sync observe() when activation leaves pending tokens above threshold', async () => {
    const record = createMockRecord();
    const mockOM = createMockOM(record);
    const messages = [createTestMessage('live-msg-1'), createTestMessage('live-msg-2')];
    const turn = createTurn(mockOM, messages);
    const step = new ObservationStep(turn, 1);

    const result = await (step as any).runThresholdObservation();

    expect(mockOM.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId,
        resourceId,
        pendingTokens: 80_000,
        messages,
      }),
    );
    expect(mockOM.getStatus).toHaveBeenCalledTimes(2);
    expect(mockOM.observe).toHaveBeenCalledTimes(1);
    expect(mockOM.observe).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId,
        resourceId,
        messages,
        trigger: 'turn-sync',
      }),
    );
    expect(result.succeeded).toBe(true);
    expect(result.activatedMessageIds).toEqual(['chunk-msg-1']);
    expect(result.observerExchange).toEqual({
      prompt: 'observer-prompt',
      response: 'observer-response',
    });
  });

  it('returns after activation without observe() when pending tokens drop below threshold', async () => {
    const record = createMockRecord();
    const mockOM = createMockOM(record);
    mockOM.getStatus
      .mockReset()
      .mockResolvedValueOnce(createStatus(record))
      .mockResolvedValueOnce(createStatus(record, { shouldObserve: false, canActivate: false, pendingTokens: 2_000 }));

    const turn = createTurn(mockOM, [createTestMessage('live-msg-1')]);
    const step = new ObservationStep(turn, 1);

    const result = await (step as any).runThresholdObservation();

    expect(mockOM.activate).toHaveBeenCalledTimes(1);
    expect(mockOM.observe).not.toHaveBeenCalled();
    expect(result.succeeded).toBe(true);
    expect(result.activatedMessageIds).toEqual(['chunk-msg-1']);
  });

  it('still sync-observes when activation does not activate any chunks', async () => {
    const record = createMockRecord();
    const mockOM = createMockOM(record);
    mockOM.activate.mockResolvedValue({ activated: false, record });
    mockOM.getStatus.mockReset().mockResolvedValueOnce(createStatus(record));

    const turn = createTurn(mockOM, [createTestMessage('live-msg-1')]);
    const step = new ObservationStep(turn, 1);

    const result = await (step as any).runThresholdObservation();

    expect(mockOM.observe).toHaveBeenCalledTimes(1);
    expect(result.succeeded).toBe(true);
    expect(result.activatedMessageIds).toBeUndefined();
  });
});
