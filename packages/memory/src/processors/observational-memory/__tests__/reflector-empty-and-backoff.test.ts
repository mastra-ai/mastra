import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { OmModelExecutionError } from '../error';
import { ReflectorRunner } from '../reflector-runner';
import { RETRY_CONFIG } from '../retry';

/**
 * A reflector model whose per-attempt output is scripted. The last entry repeats
 * if the ladder asks for more attempts than the script provides.
 */
function createScriptedModel(outputs: string[]) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    modelId: 'mock-reflector',
    doStream: async () => {
      const text = outputs[Math.min(calls, outputs.length - 1)]!;
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: '1' });
            controller.enqueue({ type: 'text-delta', id: '1', delta: text });
            controller.enqueue({ type: 'text-end', id: '1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        warnings: [],
      };
    },
  });
  return {
    model,
    get callCount() {
      return calls;
    },
  };
}

function createFailingModel(failuresBeforeSuccess = Number.POSITIVE_INFINITY) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    modelId: 'mock-failing-reflector',
    doStream: async () => {
      calls++;
      if (calls <= failuresBeforeSuccess) {
        throw new TypeError('terminated');
      }
      const text = observationsPayload('recovered summary');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: '1' });
            controller.enqueue({ type: 'text-delta', id: '1', delta: text });
            controller.enqueue({ type: 'text-end', id: '1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        warnings: [],
      };
    },
  });
  return {
    model,
    get callCount() {
      return calls;
    },
  };
}

function observationsPayload(body: string) {
  return `<observations>\n* ${body}\n</observations>`;
}

/**
 * Reflector wired so that compression "fails" for any output longer than the
 * threshold — countObservations is character length, threshold is 100.
 */
function createReflectorRunner(
  model: MockLanguageModelV2,
  overrides?: { storage?: any; buffering?: any; reflectionConfig?: any },
) {
  const createReflectionGeneration = vi.fn(async (input: any) => ({
    ...input.currentRecord,
    id: 'new-generation',
    activeObservations: input.reflection,
    observationTokenCount: input.tokenCount,
    generationCount: (input.currentRecord.generationCount ?? 0) + 1,
  }));
  const storage = {
    setReflectingFlag: vi.fn(async () => {}),
    createReflectionGeneration,
    getThreadById: vi.fn(async () => null),
    ...overrides?.storage,
  };
  const emitDebugEvent = vi.fn();
  const persistMarkerToStorage = vi.fn();
  const runner = new ReflectorRunner({
    reflectionConfig: {
      model: 'mock/model',
      observationTokens: 100,
      extractors: [],
      ...overrides?.reflectionConfig,
    } as any,
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
    } as any,
    tokenCounter: {
      countObservations: (text: string) => text?.length ?? 0,
    } as any,
    storage: storage as any,
    scope: 'thread',
    buffering: {
      getLockKey: (threadId?: string | null, resourceId?: string | null) => `${threadId}:${resourceId}`,
      isAsyncReflectionEnabled: () => false,
      ...overrides?.buffering,
    } as any,
    emitDebugEvent,
    persistMarkerToStorage,
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: model as any }),
  });
  return { runner, storage, createReflectionGeneration, emitDebugEvent, persistMarkerToStorage };
}

const SOURCE_OBSERVATIONS = `* original observation that must be compressed ${'x'.repeat(500)}`;

/** Output that trips detectDegenerateRepetition (tight repetition loop). */
const DEGENERATE_OUTPUT = 'getLanguageModel().doGenerate(options): PromiseLike<LanguageModelV2GenerateResult>, '.repeat(
  100,
);

function makeRecord(overrides?: Record<string, unknown>) {
  return {
    id: 'record-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    activeObservations: SOURCE_OBSERVATIONS,
    observationTokenCount: SOURCE_OBSERVATIONS.length,
    generationCount: 0,
    isReflecting: false,
    config: {},
    ...overrides,
  } as any;
}

describe('reflector empty-output guard', () => {
  it('throws instead of returning empty output when every attempt is degenerate', async () => {
    const scripted = createScriptedModel([DEGENERATE_OUTPUT]);
    const { runner } = createReflectorRunner(scripted.model);

    await expect(runner.call(SOURCE_OBSERVATIONS)).rejects.toThrow(/empty|degenerate/i);
  });

  it('throws when the model returns an empty observations block', async () => {
    const scripted = createScriptedModel(['<observations>\n</observations>']);
    const { runner } = createReflectorRunner(scripted.model);

    await expect(runner.call(SOURCE_OBSERVATIONS)).rejects.toThrow(/empty/i);
  });

  it('keeps degenerate sync reflection failures fatal without committing a generation', async () => {
    const scripted = createScriptedModel([DEGENERATE_OUTPUT]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model, {
      reflectionConfig: { failurePolicy: 'continue' },
    });

    await expect(
      runner.maybeReflect({
        record: makeRecord(),
        observationTokens: SOURCE_OBSERVATIONS.length,
        threadId: 'thread-1',
      }),
    ).rejects.toThrow(/empty|degenerate/i);

    expect(createReflectionGeneration).not.toHaveBeenCalled();
  });

  it('escalates the ladder on a non-degenerate empty block and succeeds on a later attempt', async () => {
    const scripted = createScriptedModel(['<observations>\n</observations>', observationsPayload('recovered summary')]);
    const { runner } = createReflectorRunner(scripted.model);

    const result = await runner.call(SOURCE_OBSERVATIONS);

    // The empty block is treated as a compression failure (not a valid
    // 0-token result), so the ladder escalates and the second attempt wins.
    expect(result.observations).toContain('recovered summary');
    expect(scripted.callCount).toBe(2);
  });

  it('refuses to write an empty buffered reflection', async () => {
    const scripted = createScriptedModel([DEGENERATE_OUTPUT]);
    const updateBufferedReflection = vi.fn(async () => {});
    // Multi-line observations so the buffered slice (bounded by the
    // activation point) contains at least one full line of real content.
    const multiLine = Array.from({ length: 20 }, (_, i) => `* observed fact number ${i}`).join('\n');
    const record = makeRecord({
      activeObservations: multiLine,
      observationTokenCount: multiLine.length,
    });
    const { runner } = createReflectorRunner(scripted.model, {
      storage: {
        updateBufferedReflection,
        getObservationalMemory: vi.fn(async () => record),
        setBufferingReflectionFlag: vi.fn(async () => {}),
      },
      buffering: {
        isAsyncReflectionEnabled: () => true,
        getReflectionBufferKey: (lockKey: string) => `refl:${lockKey}`,
        isAsyncBufferingInProgress: () => false,
      },
      reflectionConfig: { bufferActivation: 0.5 },
    });

    // Between the activation point (50) and the threshold (100) — triggers
    // background buffered reflection, not sync reflection.
    await runner.maybeReflect({
      record,
      observationTokens: 60,
      threadId: 'thread-1',
    });

    const bufferKey = 'refl:thread-1:resource-1';
    const op = BufferingCoordinator.asyncBufferingOps.get(bufferKey);
    expect(op).toBeDefined();
    await op;

    // Every attempt was degenerate → call() threw → the empty reflection was
    // never written over the reflected slice.
    expect(updateBufferedReflection).not.toHaveBeenCalled();
    expect(scripted.callCount).toBeGreaterThan(0);
    // The failure path must clear the boundary so future attempts aren't blocked.
    expect(BufferingCoordinator.lastBufferedBoundary.has(bufferKey)).toBe(false);
  });
});

describe('reflector retry budget and terminal policy', () => {
  async function withFastRetries<T>(run: () => Promise<T>): Promise<T> {
    const initialDelayMs = RETRY_CONFIG.initialDelayMs;
    const jitter = RETRY_CONFIG.jitter;
    RETRY_CONFIG.initialDelayMs = 1;
    RETRY_CONFIG.jitter = 0;
    try {
      return await run();
    } finally {
      RETRY_CONFIG.initialDelayMs = initialDelayMs;
      RETRY_CONFIG.jitter = jitter;
    }
  }

  it.each([
    { maxRetries: 0, expectedCalls: 1 },
    { maxRetries: 1, expectedCalls: 2 },
  ])('uses $maxRetries retries as $expectedCalls total model calls', async ({ maxRetries, expectedCalls }) => {
    const failing = createFailingModel();
    const { runner } = createReflectorRunner(failing.model, {
      reflectionConfig: { maxRetries },
    });

    await withFastRetries(async () => {
      await expect(runner.call(SOURCE_OBSERVATIONS)).rejects.toBeInstanceOf(OmModelExecutionError);
    });
    expect(failing.callCount).toBe(expectedCalls);
  });

  it('uses the omitted default budget of eight retries for nine total model calls', async () => {
    const failing = createFailingModel();
    const { runner } = createReflectorRunner(failing.model);

    await withFastRetries(async () => {
      await expect(runner.call(SOURCE_OBSERVATIONS)).rejects.toBeInstanceOf(OmModelExecutionError);
    });
    expect(failing.callCount).toBe(9);
  });

  it('succeeds on the configured retry without advancing the semantic ladder', async () => {
    const failing = createFailingModel(1);
    const { runner } = createReflectorRunner(failing.model, {
      reflectionConfig: { maxRetries: 1 },
    });

    const result = await withFastRetries(() => runner.call(SOURCE_OBSERVATIONS));

    expect(result.observations).toContain('recovered summary');
    expect(failing.callCount).toBe(2);
  });

  it('continues only an exhausted reflector-model failure when explicitly configured', async () => {
    const failing = createFailingModel();
    const { runner, createReflectionGeneration } = createReflectorRunner(failing.model, {
      reflectionConfig: { failurePolicy: 'continue', maxRetries: 0 },
    });

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });

    expect(failing.callCount).toBe(1);
    expect(createReflectionGeneration).not.toHaveBeenCalled();
  });

  it('preserves committed observation state after continue and commits reflection once after recovery', async () => {
    const failing = createFailingModel(1);
    const { runner, createReflectionGeneration, persistMarkerToStorage } = createReflectorRunner(failing.model, {
      reflectionConfig: { failurePolicy: 'continue', maxRetries: 0 },
    });
    const record = makeRecord();
    const stateBeforeFailure = {
      activeObservations: record.activeObservations,
      observationTokenCount: record.observationTokenCount,
      generationCount: record.generationCount,
    };

    await runner.maybeReflect({
      record,
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });

    expect(record).toMatchObject(stateBeforeFailure);
    expect(createReflectionGeneration).not.toHaveBeenCalled();
    expect(persistMarkerToStorage).toHaveBeenCalledTimes(1);
    expect(persistMarkerToStorage.mock.calls[0]![0]).toMatchObject({
      type: 'data-om-observation-failed',
      data: {
        operationType: 'reflection',
        failurePolicy: 'continue',
        failureKind: 'reflector-model',
      },
    });

    await runner.maybeReflect({
      record,
      observationTokens: SOURCE_OBSERVATIONS.length + 1,
      threadId: 'thread-1',
    });

    expect(failing.callCount).toBe(2);
    expect(createReflectionGeneration).toHaveBeenCalledTimes(1);
    expect(createReflectionGeneration.mock.calls[0]![0]).toMatchObject({
      currentRecord: record,
      reflection: expect.stringContaining('recovered summary'),
    });
    expect(record).toMatchObject(stateBeforeFailure);
  });

  it('keeps the exhausted reflector-model failure fatal under abort policy', async () => {
    const failing = createFailingModel();
    const { runner } = createReflectorRunner(failing.model, {
      reflectionConfig: { failurePolicy: 'abort', maxRetries: 0 },
    });

    await expect(
      runner.maybeReflect({
        record: makeRecord(),
        observationTokens: SOURCE_OBSERVATIONS.length,
        threadId: 'thread-1',
      }),
    ).rejects.toBeInstanceOf(OmModelExecutionError);
    expect(failing.callCount).toBe(1);
  });
});

describe('sync reflection suppression (unchanged input)', () => {
  const OVER_THRESHOLD_BODY = `still far too long to pass the 100-char threshold ${'y'.repeat(200)}`;

  it('commits a best-effort over-threshold reflection and suppresses a retry against unchanged observations', async () => {
    const scripted = createScriptedModel([observationsPayload(OVER_THRESHOLD_BODY)]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(1);
    const callsAfterFirst = scripted.callCount;
    // After the commit the record holds the (still over-threshold) reflected
    // size — that's what the next activation reports.
    const committedTokens = createReflectionGeneration.mock.calls[0]![0].tokenCount;
    expect(committedTokens).toBeGreaterThan(100);

    // Unchanged input — the ladder already ran a full cycle against exactly
    // these observations, so re-running it cannot succeed.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: committedTokens,
      threadId: 'thread-1',
    });
    expect(scripted.callCount).toBe(callsAfterFirst);
    expect(createReflectionGeneration).toHaveBeenCalledTimes(1);
  });

  it('any change in the observation count permits another attempt', async () => {
    const scripted = createScriptedModel([observationsPayload(OVER_THRESHOLD_BODY)]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    const callsAfterFirst = scripted.callCount;
    const committedTokens = createReflectionGeneration.mock.calls[0]![0].tokenCount;

    // Even a single-token increase makes the input different — no arbitrary
    // growth factor or waiting period.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: committedTokens + 1,
      threadId: 'thread-1',
    });
    expect(scripted.callCount).toBeGreaterThan(callsAfterFirst);
  });

  it('suppresses after a continued model failure while the input is unchanged', async () => {
    const failing = createFailingModel();
    const { runner, createReflectionGeneration } = createReflectorRunner(failing.model, {
      reflectionConfig: { failurePolicy: 'continue', maxRetries: 0 },
    });

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).not.toHaveBeenCalled();
    const callsAfterFirst = failing.callCount;
    expect(callsAfterFirst).toBe(1);

    // Same observation count → same input → suppressed.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(failing.callCount).toBe(callsAfterFirst);
    expect(createReflectionGeneration).not.toHaveBeenCalled();
  });

  it('retries a continued model failure as soon as observations change', async () => {
    const failing = createFailingModel();
    const { runner } = createReflectorRunner(failing.model, {
      reflectionConfig: { failurePolicy: 'continue', maxRetries: 0 },
    });

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    const callsAfterFirst = failing.callCount;

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length + 10,
      threadId: 'thread-1',
    });
    expect(failing.callCount).toBeGreaterThan(callsAfterFirst);
  });

  it('does not suppress a continued model failure for a different thread/resource lock key', async () => {
    const failing = createFailingModel();
    const { runner } = createReflectorRunner(failing.model, {
      reflectionConfig: { failurePolicy: 'continue', maxRetries: 0 },
    });

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    const callsAfterFirst = failing.callCount;

    // Identical observation count, but a different thread — its input was
    // never attempted, so it must not inherit thread-1's suppression.
    await runner.maybeReflect({
      record: makeRecord({ id: 'record-2', threadId: 'thread-2' }),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-2',
    });
    expect(failing.callCount).toBeGreaterThan(callsAfterFirst);
  });

  it('clears the suppression after a successful under-threshold reflection', async () => {
    const scripted = createScriptedModel([
      observationsPayload(OVER_THRESHOLD_BODY),
      observationsPayload(OVER_THRESHOLD_BODY),
      observationsPayload(OVER_THRESHOLD_BODY),
      observationsPayload(OVER_THRESHOLD_BODY),
      observationsPayload('tiny'),
      observationsPayload(OVER_THRESHOLD_BODY),
    ]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    // First attempt: over threshold → commit + suppress at the committed count.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(1);
    const committedTokens = createReflectionGeneration.mock.calls[0]![0].tokenCount;

    // Changed input: succeeds under threshold → suppression cleared.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: committedTokens + 7,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(2);

    // A count matching the old suppression entry now reflects immediately —
    // the entry is gone, not just bypassed.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: committedTokens,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(3);
  });
});
