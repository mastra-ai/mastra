import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

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
function createReflectorRunner(model: MockLanguageModelV2) {
  return new ReflectorRunner({
    reflectionConfig: {
      model: 'mock/model',
      observationTokens: 100,
    } as any,
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
    } as any,
    tokenCounter: {
      countObservations: (text: string) => text?.length ?? 0,
    } as any,
    storage: {} as any,
    scope: 'thread',
    buffering: {} as any,
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn(),
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: model as any }),
  });
}

/** Long enough that countObservations (character length) never clears the 100 threshold. */
const LONG_BODY = 'this observation is deliberately too long to ever pass the compression threshold '.repeat(3);
const LONG_OBSERVATIONS = `* ${LONG_BODY.trim()}`;
const SOURCE_OBSERVATIONS = `* original observation that must be compressed ${'x'.repeat(500)}`;

describe('reflector compression retry ladder', () => {
  it('keeps escalating when attempts repeat the same over-threshold output', async () => {
    const scripted = createScriptedModel([observationsPayload(LONG_BODY)]);
    const reflector = createReflectorRunner(scripted.model);

    const result = await reflector.call(SOURCE_OBSERVATIONS);

    expect(scripted.callCount).toBe(4);
    expect(result.observations).toBe(LONG_OBSERVATIONS);
  });

  it('recovers when a stronger retry succeeds after identical over-threshold attempts', async () => {
    const scripted = createScriptedModel([
      observationsPayload(LONG_BODY),
      observationsPayload(LONG_BODY),
      observationsPayload('short'),
    ]);
    const reflector = createReflectorRunner(scripted.model);

    const result = await reflector.call(SOURCE_OBSERVATIONS);

    expect(scripted.callCount).toBe(3);
    expect(result.observations).toBe('* short');
  });

  it('keeps escalating while attempts return different over-threshold output', async () => {
    const scripted = createScriptedModel([
      observationsPayload(`first ${LONG_BODY}`),
      observationsPayload(`second ${LONG_BODY}`),
      observationsPayload(`third ${LONG_BODY}`),
      observationsPayload(`fourth ${LONG_BODY}`),
    ]);
    const reflector = createReflectorRunner(scripted.model);

    await reflector.call(SOURCE_OBSERVATIONS);

    expect(scripted.callCount).toBe(4);
  });

  it('exits when a retry successfully compresses below the threshold', async () => {
    const scripted = createScriptedModel([observationsPayload(LONG_BODY), observationsPayload('short')]);
    const reflector = createReflectorRunner(scripted.model);

    const result = await reflector.call(SOURCE_OBSERVATIONS);

    expect(scripted.callCount).toBe(2);
    expect(result.observations).toBe('* short');
  });
});
