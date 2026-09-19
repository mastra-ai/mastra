import { APICallError, type Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as observabilityUtils from '../observability/utils';
import { Classifier } from './index';

type ProviderResult = Awaited<ReturnType<EvaluationModelV4['doEvaluate']>>;

const booleanQuestions = {
  unsafe: {
    type: 'boolean',
    criteria: { true: 'Unsafe', false: 'Safe' },
  },
} as const;

function createModel({
  supportedQuestionTypes = ['choice', 'score', 'boolean'],
  doEvaluate = async () => ({
    answers: { unsafe: { type: 'boolean', probability: 0.8 } },
    usage: { inputTokens: 4, outputTokens: 2 },
    warnings: [],
  }),
}: {
  supportedQuestionTypes?: EvaluationModelV4['supportedQuestionTypes'];
  doEvaluate?: EvaluationModelV4['doEvaluate'];
} = {}): EvaluationModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test-provider',
    modelId: 'test-model',
    supportedQuestionTypes,
    doEvaluate,
  };
}

function retryableError() {
  return new APICallError({
    message: 'temporary failure',
    url: 'https://example.test/evaluate',
    requestBodyValues: {},
    statusCode: 503,
    isRetryable: true,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Classifier', () => {
  it('evaluates constructor-configured questions and normalizes evidence', async () => {
    const timestamp = new Date('2026-09-19T00:00:00.000Z');
    const doEvaluate = vi.fn(async () => ({
      answers: { unsafe: { type: 'boolean' as const, probability: 0.8 } },
      usage: { inputTokens: 4, outputTokens: 2 },
      warnings: [{ type: 'other' as const, message: 'warning' }],
      rounding: { probabilityDecimals: 2 },
      providerMetadata: { test: { confidence: 0.9 } },
      response: {
        id: 'response-id',
        timestamp,
        modelId: 'provider-model',
        headers: { 'x-request-id': 'request-id' },
        body: { ok: true },
      },
    }));
    const classifier = new Classifier({ id: 'safety', model: createModel({ doEvaluate }), questions: booleanQuestions });

    const result = await classifier.evaluate({
      state: { content: 'hello' },
      providerOptions: { test: { mode: 'fast' } },
    });

    expect(doEvaluate).toHaveBeenCalledWith({
      state: { content: 'hello' },
      questions: {
        unsafe: {
          ...booleanQuestions.unsafe,
          instructions: 'unsafe',
        },
      },
      abortSignal: undefined,
      providerOptions: { test: { mode: 'fast' } },
    });
    expect(result).toEqual({
      answers: { unsafe: { type: 'boolean', probability: 0.8 } },
      usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      warnings: [{ type: 'other', message: 'warning' }],
      rounding: { probabilityDecimals: 2 },
      providerMetadata: { test: { confidence: 0.9 } },
      response: {
        id: 'response-id',
        timestamp,
        modelId: 'provider-model',
        headers: { 'x-request-id': 'request-id' },
        body: { ok: true },
      },
    });
  });

  it('evaluates per-call choice and score questions and supplies response defaults', async () => {
    const before = Date.now();
    const model = createModel({
      doEvaluate: async () => ({
        answers: {
          route: { type: 'choice', choice: 'support', probabilities: { support: 0.7, sales: 0.3 } },
          quality: { type: 'score', score: 1.5, probabilities: { '0': 0, '1': 0.5, '2': 0.5 } },
        },
        warnings: [],
      }),
    });
    const classifier = new Classifier({ id: 'router', model });
    const questions = {
      route: {
        type: 'choice',
        instructions: 'Choose a route',
        criteria: { support: 'Support', sales: 'Sales' },
      },
      quality: {
        type: 'score',
        instructions: 'Score quality',
        criteria: ['Poor', 'Good', 'Excellent'],
      },
    } as const;

    const result = await classifier.evaluate({ state: 'request', questions });

    expect(result.answers.route.choice).toBe('support');
    expect(result.answers.quality.score).toBe(1.5);
    expect(result.usage).toEqual({ inputTokens: undefined, outputTokens: undefined, totalTokens: 0 });
    expect(result.response.modelId).toBe('test-model');
    expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects unsupported and malformed input before provider I/O', async () => {
    const doEvaluate = vi.fn();
    const model = createModel({ supportedQuestionTypes: ['boolean'], doEvaluate });

    expect(
      () =>
        new Classifier({
          id: 'router',
          model,
          questions: { route: { type: 'choice', instructions: 'Route', criteria: { support: 'Support' } } },
        }),
    ).toThrow(/not supported/i);

    const classifier = new Classifier({ id: 'runtime', model: createModel({ doEvaluate }) });
    await expect(classifier.evaluate({ state: Number.NaN as never, questions: booleanQuestions })).rejects.toThrow(
      /JSON-compatible/,
    );
    await expect(
      classifier.evaluate({ state: 'ok', questions: {} as never }),
    ).rejects.toThrow(/non-empty object/);
    await expect(
      classifier.evaluate({
        state: 'ok',
        questions: { score: { type: 'score', instructions: 'Score', criteria: ['only one'] } } as never,
      }),
    ).rejects.toThrow(/at least two levels/);
    expect(doEvaluate).not.toHaveBeenCalled();
  });

  it.each([
    [{ unsafe: { type: 'choice', choice: 'yes' } }, 'does not match'],
    [{}, 'exactly one answer'],
    [{ unsafe: { type: 'boolean', probability: 2 } }, 'between 0 and 1'],
  ])('rejects malformed boolean output %#', async (answers, message) => {
    const classifier = new Classifier({
      id: 'safety',
      model: createModel({ doEvaluate: async () => ({ answers, warnings: [] }) as ProviderResult }),
      questions: booleanQuestions,
    });
    await expect(classifier.evaluate({ state: 'content' })).rejects.toThrow(message);
  });

  it('rejects malformed choice and score distributions', async () => {
    const questions = {
      route: { type: 'choice', instructions: 'Route', criteria: { support: 'Support', sales: 'Sales' } },
      score: { type: 'score', instructions: 'Score', criteria: ['Low', 'High'] },
    } as const;
    const classifier = new Classifier({
      id: 'judge',
      model: createModel({
        doEvaluate: async () => ({
          answers: {
            route: { type: 'choice', choice: 'support', probabilities: { support: 0.4, sales: 0.6 } },
            score: { type: 'score', score: 0.8, probabilities: { '0': 0.5, '1': 0.5 } },
          },
          warnings: [],
        }),
      }),
      questions,
    });

    await expect(classifier.evaluate({ state: 'content' })).rejects.toThrow(/highest-probability/);
  });

  it('retries retryable failures and stops after success', async () => {
    vi.useFakeTimers();
    const doEvaluate = vi
      .fn<EvaluationModelV4['doEvaluate']>()
      .mockRejectedValueOnce(retryableError())
      .mockResolvedValue({ answers: { unsafe: { type: 'boolean', probability: 0.2 } }, warnings: [] });
    const classifier = new Classifier({ id: 'retry', model: createModel({ doEvaluate }), questions: booleanQuestions });

    const resultPromise = classifier.evaluate({ state: 'content', maxRetries: 2 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({ answers: { unsafe: { probability: 0.2 } } });
    expect(doEvaluate).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable failures and exhausts retryable failures', async () => {
    const permanent = new Error('permanent');
    const noRetry = vi.fn<EvaluationModelV4['doEvaluate']>().mockRejectedValue(permanent);
    const classifier = new Classifier({ id: 'no-retry', model: createModel({ doEvaluate: noRetry }), questions: booleanQuestions });
    await expect(classifier.evaluate({ state: 'content' })).rejects.toBe(permanent);
    expect(noRetry).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const exhausted = vi.fn<EvaluationModelV4['doEvaluate']>().mockRejectedValue(retryableError());
    const exhaustedClassifier = new Classifier({
      id: 'exhausted',
      model: createModel({ doEvaluate: exhausted }),
      questions: booleanQuestions,
    });
    const resultPromise = exhaustedClassifier.evaluate({ state: 'content', maxRetries: 1 });
    const rejection = expect(resultPromise).rejects.toThrow('temporary failure');
    await vi.runAllTimersAsync();
    await rejection;
    expect(exhausted).toHaveBeenCalledTimes(2);
  });

  it('propagates aborts before, during, and after provider execution', async () => {
    const beforeController = new AbortController();
    beforeController.abort(new Error('before'));
    const beforeCall = vi.fn<EvaluationModelV4['doEvaluate']>();
    const beforeClassifier = new Classifier({
      id: 'before',
      model: createModel({ doEvaluate: beforeCall }),
      questions: booleanQuestions,
    });
    await expect(beforeClassifier.evaluate({ state: 'content', abortSignal: beforeController.signal })).rejects.toThrow(
      'before',
    );
    expect(beforeCall).not.toHaveBeenCalled();

    const duringController = new AbortController();
    const duringClassifier = new Classifier({
      id: 'during',
      model: createModel({
        doEvaluate: ({ abortSignal }) =>
          new Promise((_, reject) => abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true })),
      }),
      questions: booleanQuestions,
    });
    const duringResult = duringClassifier.evaluate({ state: 'content', abortSignal: duringController.signal });
    duringController.abort(new Error('during'));
    await expect(duringResult).rejects.toThrow('during');

    const afterController = new AbortController();
    const afterClassifier = new Classifier({
      id: 'after',
      model: createModel({
        doEvaluate: async () => {
          afterController.abort(new Error('after'));
          return { answers: { unsafe: { type: 'boolean', probability: 0.5 } }, warnings: [] };
        },
      }),
      questions: booleanQuestions,
    });
    await expect(afterClassifier.evaluate({ state: 'content', abortSignal: afterController.signal })).rejects.toThrow(
      'after',
    );
  });

  it('records only safe classifier tracing metadata', async () => {
    const childSpan = { update: vi.fn(), end: vi.fn(), error: vi.fn() };
    const parentSpan = { createChildSpan: vi.fn(() => childSpan) };
    vi.spyOn(observabilityUtils, 'resolveCurrentSpan').mockReturnValue(parentSpan as never);
    const classifier = new Classifier({ id: 'safe-id', model: createModel(), questions: booleanQuestions });

    await classifier.evaluate({ state: { secret: 'sensitive-state' } });

    const serializedCalls = JSON.stringify([parentSpan.createChildSpan.mock.calls, childSpan.update.mock.calls]);
    expect(serializedCalls).toContain('safe-id');
    expect(serializedCalls).toContain('test-model');
    expect(serializedCalls).not.toContain('sensitive-state');
    expect(serializedCalls).not.toContain('Unsafe');
    expect(serializedCalls).not.toContain('probability');
    expect(childSpan.end).toHaveBeenCalledOnce();
  });
});
