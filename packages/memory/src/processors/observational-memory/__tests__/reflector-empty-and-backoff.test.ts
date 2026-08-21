import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReflectorRunner } from '../reflector-runner';

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

function observationsPayload(body: string) {
  return `<observations>\n* ${body}\n</observations>`;
}

/**
 * Reflector wired so that compression "fails" for any output longer than the
 * threshold — countObservations is character length, threshold is 100.
 */
function createReflectorRunner(model: MockLanguageModelV2, overrides?: { storage?: any; buffering?: any }) {
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
  const runner = new ReflectorRunner({
    reflectionConfig: {
      model: 'mock/model',
      observationTokens: 100,
      extractors: [],
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
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn(),
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: model as any }),
  });
  return { runner, storage, createReflectionGeneration };
}

const SOURCE_OBSERVATIONS = `* original observation that must be compressed ${'x'.repeat(500)}`;

/** Output that trips detectDegenerateRepetition (tight repetition loop). */
const DEGENERATE_OUTPUT = 'getLanguageModel().doGenerate(options): PromiseLike<LanguageModelV2GenerateResult>, '.repeat(
  100,
);

function makeRecord() {
  return {
    id: 'record-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    activeObservations: SOURCE_OBSERVATIONS,
    observationTokenCount: SOURCE_OBSERVATIONS.length,
    generationCount: 0,
    isReflecting: false,
    config: {},
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

  it('never commits an empty reflection generation from the sync path', async () => {
    const scripted = createScriptedModel([DEGENERATE_OUTPUT]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });

    // Reflection failed (degenerate everywhere) — activeObservations must survive.
    expect(createReflectionGeneration).not.toHaveBeenCalled();
  });
});

describe('sync reflection backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const OVER_THRESHOLD_BODY = `still far too long to pass the 100-char threshold ${'y'.repeat(200)}`;

  it('commits a best-effort over-threshold reflection but backs off the next attempt', async () => {
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

    // Still over threshold — without backoff this would run the ladder again.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: committedTokens,
      threadId: 'thread-1',
    });
    expect(scripted.callCount).toBe(callsAfterFirst);
    expect(createReflectionGeneration).toHaveBeenCalledTimes(1);
  });

  it('retries after the backoff window elapses', async () => {
    const scripted = createScriptedModel([observationsPayload(OVER_THRESHOLD_BODY)]);
    const { runner } = createReflectorRunner(scripted.model);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    const callsAfterFirst = scripted.callCount;

    vi.advanceTimersByTime(5 * 60_000 + 1);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(scripted.callCount).toBeGreaterThan(callsAfterFirst);
  });

  it('retries within the backoff window once observations grow substantially', async () => {
    const scripted = createScriptedModel([observationsPayload(OVER_THRESHOLD_BODY)]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    const callsAfterFirst = scripted.callCount;
    // Committed size is the backoff anchor — grow well past the 1.15x escape.
    const committedTokens = createReflectionGeneration.mock.calls[0]![0].tokenCount;
    const grownTokens = Math.ceil(committedTokens * 1.5);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: grownTokens,
      threadId: 'thread-1',
    });
    expect(scripted.callCount).toBeGreaterThan(callsAfterFirst);
  });

  it('backs off after a failed (degenerate) reflection without committing', async () => {
    const scripted = createScriptedModel([DEGENERATE_OUTPUT]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).not.toHaveBeenCalled();
    const callsAfterFirst = scripted.callCount;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(scripted.callCount).toBe(callsAfterFirst);
    expect(createReflectionGeneration).not.toHaveBeenCalled();
  });

  it('clears the backoff after a successful under-threshold reflection', async () => {
    const scripted = createScriptedModel([
      observationsPayload(OVER_THRESHOLD_BODY),
      observationsPayload(OVER_THRESHOLD_BODY),
      observationsPayload('tiny'),
      observationsPayload(OVER_THRESHOLD_BODY),
    ]);
    const { runner, createReflectionGeneration } = createReflectorRunner(scripted.model);

    // First attempt: over threshold → commit + backoff.
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(1);

    // After the window: succeeds under threshold → backoff cleared.
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(2);

    // Next over-threshold reflection runs immediately (no lingering backoff).
    await runner.maybeReflect({
      record: makeRecord(),
      observationTokens: SOURCE_OBSERVATIONS.length,
      threadId: 'thread-1',
    });
    expect(createReflectionGeneration).toHaveBeenCalledTimes(3);
  });
});
