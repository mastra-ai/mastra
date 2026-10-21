import { APICallError } from '@ai-sdk/provider-v7';
import type {
  Experimental_DecisionModelV4 as DecisionModelV4,
  Experimental_EvaluationModelV4 as EvaluationModelV4,
} from '@ai-sdk/provider-v7';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraBase } from '../base';
import { EntityType, SpanType } from '../observability/types';
import * as observabilityUtils from '../observability/utils';
import { Classifier, MastraDecisionModel, MastraEvaluationModel } from './index';

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
  it('uses Mastra primitives and supports custom evaluation response transforms', async () => {
    class TransformedEvaluationModel extends MastraDecisionModel {
      protected override transformResult(result: ProviderResult): ProviderResult {
        return {
          ...result,
          answers: { unsafe: { type: 'boolean', probability: 0.1 } },
        };
      }
    }

    const model = new TransformedEvaluationModel(createModel());
    const classifier = new Classifier({ id: 'transformed', model, questions: booleanQuestions });

    expect(classifier).toBeInstanceOf(MastraBase);
    expect(classifier.model).toBe(model);
    await expect(classifier.decide({ state: 'content' })).resolves.toMatchObject({
      answers: { unsafe: { probability: 0.1 } },
    });
  });

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
    const classifier = new Classifier({
      id: 'safety',
      model: createModel({ doEvaluate }),
      questions: booleanQuestions,
    });

    const result = await classifier.decide({
      state: { content: 'hello' },
      providerOptions: { test: { mode: 'fast' } },
    });

    expect(doEvaluate).toHaveBeenCalledWith({
      state: [{ type: 'json', value: { content: 'hello' } }],
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

  describe('decision models', () => {
    function createDecisionModel(doDecide: DecisionModelV4['doDecide']): DecisionModelV4 {
      return {
        specificationVersion: 'v4',
        provider: 'openai.decisions',
        modelId: 'gpt-6-luna',
        supportedQuestionTypes: ['choice', 'score', 'boolean'],
        doDecide,
      };
    }

    const questions = {
      unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
      route: { type: 'choice', criteria: { support: 'Support', sales: 'Sales' } },
      quality: { type: 'score', criteria: ['Poor', 'Good', 'Excellent'] },
    } as const;

    it('calls doDecide and returns boolean, choice, and score answers with usage and probabilities', async () => {
      const doDecide = vi.fn<DecisionModelV4['doDecide']>(async () => ({
        answers: {
          unsafe: { type: 'boolean', probability: 0.25 },
          route: { type: 'choice', choice: 'sales', probabilities: { support: 0.4, sales: 0.6 } },
          quality: { type: 'score', score: 2, probabilities: { '0': 0, '1': 0, '2': 1 } },
        },
        usage: { inputTokens: 10, outputTokens: 1 },
        providerMetadata: { openai: { decisionId: 'dec_123' } },
        warnings: [],
      }));
      const classifier = new Classifier({ id: 'decision', model: createDecisionModel(doDecide) });

      const result = await classifier.decide({ state: 'hello', questions });

      expect(doDecide).toHaveBeenCalledTimes(1);
      expect(result.answers).toEqual({
        unsafe: { type: 'boolean', probability: 0.25 },
        route: { type: 'choice', choice: 'sales', probabilities: { support: 0.4, sales: 0.6 } },
        quality: { type: 'score', score: 2, probabilities: { '0': 0, '1': 0, '2': 1 } },
      });
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 1, totalTokens: 11 });
      expect(result.providerMetadata).toEqual({ openai: { decisionId: 'dec_123' } });
      expect(result.response.modelId).toBe('gpt-6-luna');
    });

    it('surfaces non-retryable provider errors such as refusals', async () => {
      const refusal = new APICallError({
        message: 'The model refused to answer',
        url: 'https://example.test/decisions',
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
      });
      const doDecide = vi.fn<DecisionModelV4['doDecide']>(async () => {
        throw refusal;
      });
      const classifier = new Classifier({ id: 'refusal', model: createDecisionModel(doDecide) });

      await expect(classifier.decide({ state: 'hello', questions })).rejects.toBe(refusal);
      expect(doDecide).toHaveBeenCalledTimes(1);
    });

    it('prefers doDecide when a model exposes both doDecide and the legacy doEvaluate alias', async () => {
      const doDecide = vi.fn<DecisionModelV4['doDecide']>(async () => ({
        answers: { unsafe: { type: 'boolean', probability: 0.5 } },
        warnings: [],
      }));
      const doEvaluate = vi.fn();
      const model = { ...createDecisionModel(doDecide), doEvaluate };

      await new Classifier({ id: 'both', model, questions: booleanQuestions }).decide({ state: 'x' });

      expect(doDecide).toHaveBeenCalledTimes(1);
      expect(doEvaluate).not.toHaveBeenCalled();
    });

    it('converts state into provider parts like the AI SDK does', async () => {
      const doDecide = vi.fn<DecisionModelV4['doDecide']>(async () => ({
        answers: { unsafe: { type: 'boolean', probability: 0.5 } },
        warnings: [],
      }));
      const classifier = new Classifier({
        id: 'parts',
        model: createDecisionModel(doDecide),
        questions: booleanQuestions,
      });
      const parts = [
        { type: 'text', text: 'hi' },
        { type: 'json', value: { a: 1 } },
      ] as const;

      await classifier.decide({ state: 'I was charged twice' });
      await classifier.decide({ state: { message: 'hi' } });
      await classifier.decide({ state: parts });
      await classifier.decide({ state: ['a', 1] });
      await classifier.decide({ state: [{ type: 'text', text: 'hi' }, 'b'] });

      expect(doDecide.mock.calls.map(([options]) => options.state)).toEqual([
        [{ type: 'text', text: 'I was charged twice' }],
        [{ type: 'json', value: { message: 'hi' } }],
        parts,
        [{ type: 'json', value: ['a', 1] }],
        [{ type: 'json', value: [{ type: 'text', text: 'hi' }, 'b'] }],
      ]);
    });

    it('keeps the deprecated evaluate() and MastraEvaluationModel working', async () => {
      const doDecide = vi.fn<DecisionModelV4['doDecide']>(async () => ({
        answers: { unsafe: { type: 'boolean', probability: 0.3 } },
        warnings: [],
      }));
      const model = new MastraEvaluationModel(createDecisionModel(doDecide));
      const classifier = new Classifier({ id: 'deprecated', model, questions: booleanQuestions });

      const result = await classifier.evaluate({ state: 'x' });

      expect(model).toBeInstanceOf(MastraDecisionModel);
      expect(classifier.model).toBe(model);
      expect(result.answers.unsafe.probability).toBe(0.3);
      expect(doDecide).toHaveBeenCalledTimes(1);
    });

    it('still calls doEvaluate overrides on MastraEvaluationModel subclasses', async () => {
      const doDecide = vi.fn<DecisionModelV4['doDecide']>();
      class LegacyOverrideModel extends MastraEvaluationModel {
        override async doEvaluate() {
          return { answers: { unsafe: { type: 'boolean' as const, probability: 0.9 } }, warnings: [] };
        }
      }

      const result = await new Classifier({
        id: 'legacy-override',
        model: new LegacyOverrideModel(createDecisionModel(doDecide)),
        questions: booleanQuestions,
      }).decide({ state: 'x' });

      expect(result.answers.unsafe.probability).toBe(0.9);
      expect(doDecide).not.toHaveBeenCalled();
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

    const result = await classifier.decide({ state: 'request', questions });

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
    await expect(classifier.decide({ state: Number.NaN as never, questions: booleanQuestions })).rejects.toThrow(
      /JSON-compatible/,
    );
    await expect(classifier.decide({ state: 'ok', questions: {} as never })).rejects.toThrow(/non-empty object/);
    await expect(
      classifier.decide({
        state: 'ok',
        questions: { score: { type: 'score', instructions: 'Score', criteria: ['only one'] } } as never,
      }),
    ).rejects.toThrow(/at least two levels/);
    expect(doEvaluate).not.toHaveBeenCalled();
  });

  it('accepts refusal answers for any question type', async () => {
    const questions = {
      route: { type: 'choice', instructions: 'Route', criteria: { support: 'Support', sales: 'Sales' } },
      score: { type: 'score', instructions: 'Score', criteria: ['Low', 'High'] },
      unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
    } as const;
    const classifier = new Classifier({
      id: 'refusals',
      model: createModel({
        doEvaluate: async () => ({
          answers: {
            route: { type: 'refusal' },
            score: { type: 'refusal' },
            unsafe: { type: 'refusal' },
          },
          warnings: [],
        }),
      }),
      questions,
    });

    const result = await classifier.decide({ state: 'content' });
    expect(result.answers).toEqual({
      route: { type: 'refusal' },
      score: { type: 'refusal' },
      unsafe: { type: 'refusal' },
    });
  });

  it('keeps answered questions when another question is refused', async () => {
    const questions = {
      route: { type: 'choice', instructions: 'Route', criteria: { support: 'Support', sales: 'Sales' } },
      risk: { type: 'boolean', criteria: { true: 'Risky', false: 'Safe' } },
    } as const;
    const classifier = new Classifier({
      id: 'mixed',
      model: createModel({
        doEvaluate: async () => ({
          answers: {
            route: { type: 'choice', choice: 'support' },
            risk: { type: 'refusal' },
          },
          warnings: [],
        }),
      }),
      questions,
    });

    const result = await classifier.decide({ state: 'content' });
    expect(result.answers.route).toMatchObject({ type: 'choice', choice: 'support' });
    expect(result.answers.risk).toEqual({ type: 'refusal' });
  });

  it.each([
    [{ unsafe: { type: 'choice', choice: 'yes' } }, 'does not match'],
    [{ unsafe: { type: 'bogus' } }, 'does not match'],
    [{ unsafe: { type: 'refusal', probability: 0 } }, 'must not include answer fields'],
    [{}, 'exactly one answer'],
    [{ unsafe: { type: 'boolean', probability: 2 } }, 'between 0 and 1'],
  ])('rejects malformed boolean output %#', async (answers, message) => {
    const classifier = new Classifier({
      id: 'safety',
      model: createModel({ doEvaluate: async () => ({ answers, warnings: [] }) as ProviderResult }),
      questions: booleanQuestions,
    });
    await expect(classifier.decide({ state: 'content' })).rejects.toThrow(message);
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

    await expect(classifier.decide({ state: 'content' })).rejects.toThrow(/highest-probability/);
  });

  it('retries retryable failures and stops after success', async () => {
    vi.useFakeTimers();
    const doEvaluate = vi
      .fn<EvaluationModelV4['doEvaluate']>()
      .mockRejectedValueOnce(retryableError())
      .mockResolvedValue({ answers: { unsafe: { type: 'boolean', probability: 0.2 } }, warnings: [] });
    const classifier = new Classifier({ id: 'retry', model: createModel({ doEvaluate }), questions: booleanQuestions });

    const resultPromise = classifier.decide({ state: 'content', maxRetries: 2 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({ answers: { unsafe: { probability: 0.2 } } });
    expect(doEvaluate).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable failures and exhausts retryable failures', async () => {
    const permanent = new Error('permanent');
    const noRetry = vi.fn<EvaluationModelV4['doEvaluate']>().mockRejectedValue(permanent);
    const classifier = new Classifier({
      id: 'no-retry',
      model: createModel({ doEvaluate: noRetry }),
      questions: booleanQuestions,
    });
    await expect(classifier.decide({ state: 'content' })).rejects.toBe(permanent);
    expect(noRetry).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const exhausted = vi.fn<EvaluationModelV4['doEvaluate']>().mockRejectedValue(retryableError());
    const exhaustedClassifier = new Classifier({
      id: 'exhausted',
      model: createModel({ doEvaluate: exhausted }),
      questions: booleanQuestions,
    });
    const resultPromise = exhaustedClassifier.decide({ state: 'content', maxRetries: 1 });
    const rejection = expect(resultPromise).rejects.toThrow('temporary failure');
    await vi.runAllTimersAsync();
    await rejection;
    expect(exhausted).toHaveBeenCalledTimes(2);
  });

  it('propagates an abort that occurs during a retry delay', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const abortReason = new Error('cancel retry');
    const doEvaluate = vi.fn<EvaluationModelV4['doEvaluate']>().mockRejectedValue(retryableError());
    const classifier = new Classifier({
      id: 'abort-retry',
      model: createModel({ doEvaluate }),
      questions: booleanQuestions,
    });

    const resultPromise = classifier.decide({ state: 'content', abortSignal: controller.signal, maxRetries: 2 });
    const rejection = expect(resultPromise).rejects.toBe(abortReason);
    await Promise.resolve();
    await Promise.resolve();
    expect(doEvaluate).toHaveBeenCalledOnce();

    controller.abort(abortReason);
    await vi.runAllTimersAsync();
    await rejection;
    expect(doEvaluate).toHaveBeenCalledOnce();
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
    await expect(beforeClassifier.decide({ state: 'content', abortSignal: beforeController.signal })).rejects.toThrow(
      'before',
    );
    expect(beforeCall).not.toHaveBeenCalled();

    const duringController = new AbortController();
    const duringClassifier = new Classifier({
      id: 'during',
      model: createModel({
        doEvaluate: ({ abortSignal }) =>
          new Promise((_, reject) =>
            abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true }),
          ),
      }),
      questions: booleanQuestions,
    });
    const duringResult = duringClassifier.decide({ state: 'content', abortSignal: duringController.signal });
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
    await expect(afterClassifier.decide({ state: 'content', abortSignal: afterController.signal })).rejects.toThrow(
      'after',
    );
  });

  it('rejects provider envelope fields that do not match their declared types', async () => {
    const cases: { name: string; result: unknown; message: RegExp }[] = [
      {
        name: 'non-numeric token count',
        result: {
          answers: { unsafe: { type: 'boolean', probability: 0.5 } },
          usage: { inputTokens: '52', outputTokens: 2 },
          warnings: [],
        },
        message: /non-numeric 'inputTokens'/,
      },
      {
        name: 'NaN token count',
        result: {
          answers: { unsafe: { type: 'boolean', probability: 0.5 } },
          usage: { inputTokens: Number.NaN, outputTokens: 2 },
          warnings: [],
        },
        message: /non-numeric 'inputTokens'/,
      },
      {
        name: 'warnings that are not an array',
        result: { answers: { unsafe: { type: 'boolean', probability: 0.5 } }, warnings: 'oops' },
        message: /warnings that are not an array/,
      },
      {
        name: 'timestamp that is not a Date',
        result: {
          answers: { unsafe: { type: 'boolean', probability: 0.5 } },
          warnings: [],
          response: { timestamp: 'not-a-date' },
        },
        message: /timestamp that is not a Date/,
      },
    ];

    for (const { name, result, message } of cases) {
      const classifier = new Classifier({
        id: name,
        model: createModel({ doEvaluate: async () => result as ProviderResult }),
        questions: booleanQuestions,
      });
      await expect(classifier.decide({ state: 'content' }), name).rejects.toThrow(message);
    }
  });

  it('rejects score criteria that are holes rather than rubric levels', () => {
    expect(
      () =>
        new Classifier({
          id: 'holes',
          model: createModel(),
          // `length` satisfies the two-level check, but neither level exists.
          questions: { quality: { type: 'score', criteria: new Array(2) } } as never,
        }),
    ).toThrow(/criterion 0 is missing/);
  });

  it('preserves the provider error when retries are exhausted', async () => {
    const classifier = new Classifier({
      id: 'exhausted',
      model: createModel({
        doEvaluate: async () => {
          throw retryableError();
        },
      }),
      questions: booleanQuestions,
    });

    // Core reads `APICallError.isInstance` and `isRetryable` for control flow,
    // so exhaustion must not replace the provider error with a generic one.
    const error = await classifier.decide({ state: 'content', maxRetries: 1 }).catch((e: unknown) => e);
    expect(APICallError.isInstance(error)).toBe(true);
    expect((error as APICallError).isRetryable).toBe(true);
    expect((error as APICallError).statusCode).toBe(503);
  });

  it('records the state and questions as span input and the answers as span output', async () => {
    const childSpan = { update: vi.fn(), end: vi.fn(), error: vi.fn() };
    const parentSpan = { createChildSpan: vi.fn(() => childSpan) };
    vi.spyOn(observabilityUtils, 'resolveCurrentSpan').mockReturnValue(parentSpan as never);
    const classifier = new Classifier({ id: 'router', model: createModel(), questions: booleanQuestions });
    const state = { message: 'I was charged twice' };

    await classifier.decide({ state });

    expect(parentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { state, questions: booleanQuestions },
        attributes: expect.objectContaining({ classifierId: 'router', modelId: 'test-model' }),
      }),
    );
    expect(childSpan.end).toHaveBeenCalledExactlyOnceWith({
      output: { answers: { unsafe: { type: 'boolean', probability: 0.8 } } },
    });
  });

  it('tags a nested evaluation span with the classifier entity', async () => {
    const childSpan = { update: vi.fn(), end: vi.fn(), error: vi.fn() };
    const parentSpan = { createChildSpan: vi.fn(() => childSpan) };
    vi.spyOn(observabilityUtils, 'resolveCurrentSpan').mockReturnValue(parentSpan as never);
    const classifier = new Classifier({ id: 'router', model: createModel(), questions: booleanQuestions });

    await classifier.decide({ state: 'content' });

    expect(parentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.CLASSIFIER_EVALUATION,
        entityType: EntityType.CLASSIFIER,
        entityId: 'router',
        entityName: 'router',
      }),
    );
  });

  it('tags a root evaluation span started through registered Mastra observability with the classifier entity', async () => {
    const rootSpan = { update: vi.fn(), end: vi.fn(), error: vi.fn() };
    const instance = { startSpan: vi.fn(() => rootSpan) };
    vi.spyOn(observabilityUtils, 'resolveCurrentSpan').mockReturnValue(undefined);
    const classifier = new Classifier({ id: 'router', model: createModel(), questions: booleanQuestions });
    classifier.__registerMastra({ observability: { getSelectedInstance: () => instance } } as never);

    await classifier.decide({ state: 'content' });

    expect(instance.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.CLASSIFIER_EVALUATION,
        entityType: EntityType.CLASSIFIER,
        entityId: 'router',
        entityName: 'router',
      }),
    );
  });
});
