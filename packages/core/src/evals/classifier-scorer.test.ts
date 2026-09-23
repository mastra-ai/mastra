import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';

import { Classifier } from '../classifier';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { ScorerRunError } from './base';
import { createClassifierScorer } from './classifier-scorer';

const questions = {
  route: {
    type: 'choice',
    criteria: { correct: 'Correct', partial: 'Partially correct', incorrect: 'Incorrect' },
  },
  quality: {
    type: 'score',
    criteria: ['Poor', 'Good', 'Excellent'],
  },
  factual: {
    type: 'boolean',
    criteria: { true: 'Factual', false: 'Not factual' },
  },
} as const;

function createModel(): EvaluationModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test',
    modelId: 'test-model',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    doEvaluate: vi.fn(),
  };
}

function createClassifier() {
  return new Classifier({ id: 'response-judge', model: createModel(), questions });
}

const timestamp = new Date('2026-09-19T00:00:00.000Z');

function mockResult(answer: any) {
  return {
    answers: { route: answer, quality: answer, factual: answer },
    usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
    warnings: [{ type: 'other' as const, message: 'warning' }],
    rounding: { probabilityDecimals: 2 },
    providerMetadata: { test: { confidence: 0.9 } },
    response: {
      id: 'response-id',
      timestamp,
      modelId: 'provider-model',
      headers: { authorization: 'secret' },
      body: { private: true },
    },
  };
}

describe('createClassifierScorer', () => {
  it('projects choice answers with explicit scores and retains safe evidence', async () => {
    const classifier = createClassifier();
    vi.spyOn(classifier, 'evaluate').mockResolvedValue(
      mockResult({
        type: 'choice',
        choice: 'partial',
        probabilities: { correct: 0.1, partial: 0.8, incorrect: 0.1 },
      }) as any,
    );
    const scorer = createClassifierScorer({
      id: 'route-score',
      classifier,
      question: 'route',
      scores: { correct: 1, partial: 0.5, incorrect: 0 },
      state: ({ run }) => ({ input: run.input, output: run.output }),
    });

    const result = await scorer.run({ input: 'question', output: 'answer' });

    expect(result.score).toBe(0.5);
    expect(result.reason).toBe("Classifier question 'route' selected 'partial' (score: 0.5).");
    expect(result.analyzeStepResult).toEqual({
      question: 'route',
      answer: {
        type: 'choice',
        choice: 'partial',
        probabilities: { correct: 0.1, partial: 0.8, incorrect: 0.1 },
      },
      usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      warnings: [{ type: 'other', message: 'warning' }],
      rounding: { probabilityDecimals: 2 },
      providerMetadata: { test: { confidence: 0.9 } },
      response: { id: 'response-id', timestamp, modelId: 'provider-model' },
    });
    expect(result.analyzeStepResult?.response).not.toHaveProperty('headers');
    expect(result.analyzeStepResult?.response).not.toHaveProperty('body');
  });

  it('normalizes score answers to 0-1 and projects boolean probabilities directly', async () => {
    const scoreClassifier = createClassifier();
    vi.spyOn(scoreClassifier, 'evaluate').mockResolvedValue(mockResult({ type: 'score', score: 1.5 }) as any);
    const scoreScorer = createClassifierScorer({
      id: 'quality-score',
      classifier: scoreClassifier,
      question: 'quality',
      state: ({ run }) => run.output,
    });

    const booleanClassifier = createClassifier();
    vi.spyOn(booleanClassifier, 'evaluate').mockResolvedValue(
      mockResult({ type: 'boolean', probability: 0.37 }) as any,
    );
    const booleanScorer = createClassifierScorer({
      id: 'factual-score',
      classifier: booleanClassifier,
      question: 'factual',
      state: ({ run }) => run.output,
    });

    await expect(scoreScorer.run({ output: 'answer' })).resolves.toMatchObject({ score: 0.75 });
    await expect(booleanScorer.run({ output: 'answer' })).resolves.toMatchObject({ score: 0.37 });
  });

  it('forwards the selected state and classifier options', async () => {
    const classifier = createClassifier();
    const evaluate = vi
      .spyOn(classifier, 'evaluate')
      .mockResolvedValue(mockResult({ type: 'boolean', probability: 0.8 }) as any);
    const scorer = createClassifierScorer({
      id: 'factual-score',
      classifier,
      question: 'factual',
      state: ({ run }) => run.output,
      maxRetries: 4,
      providerOptions: { test: { mode: 'fast' } },
    });

    await scorer.run({ output: { text: 'answer' } });

    expect(evaluate).toHaveBeenCalledWith({
      state: { text: 'answer' },
      maxRetries: 4,
      providerOptions: { test: { mode: 'fast' } },
    });
  });

  it('passes the run request context to the state selector', async () => {
    const classifier = createClassifier();
    const evaluate = vi
      .spyOn(classifier, 'evaluate')
      .mockResolvedValue(mockResult({ type: 'boolean', probability: 0.8 }) as any);
    const scorer = createClassifierScorer({
      id: 'policy-factual',
      classifier,
      question: 'factual',
      state: ({ run }) => `${(run.requestContext as Record<string, string>).policy}: ${run.output}`,
    });

    await scorer.run({ output: 'answer', requestContext: { policy: 'cite sources' } });

    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ state: 'cite sources: answer' }));
  });

  it('resolves registered classifier IDs at run time', async () => {
    const classifier = createClassifier();
    vi.spyOn(classifier, 'evaluate').mockResolvedValue(mockResult({ type: 'score', score: 1 }) as any);
    const scorer = createClassifierScorer<typeof classifier, 'quality'>({
      id: 'registered-score',
      classifier: 'response-judge',
      question: 'quality',
      state: ({ run }) => run.output,
    });
    new Mastra({ classifiers: { classifier }, scorers: { scorer } });

    await expect(scorer.run({ output: 'answer' })).resolves.toMatchObject({ score: 0.5 });
  });

  it('fails actionably when an ID-backed scorer is not registered', async () => {
    const classifier = createClassifier();
    const scorer = createClassifierScorer<typeof classifier, 'quality'>({
      id: 'unregistered-score',
      classifier: 'missing-classifier',
      question: 'quality',
      state: ({ run }) => run.output,
    });

    const error = await scorer.run({ output: 'answer' }).catch(err => err);
    expect(error).toBeInstanceOf(ScorerRunError);
    expect(error).toMatchObject({ failedStep: 'analyze' });
    await expect(scorer.run({ output: 'answer' })).rejects.toThrow(
      /Classifier 'missing-classifier' for scorer 'unregistered-score'.*not registered with Mastra/,
    );
  });

  it('keeps the lookup error as the cause when a registered ID is unknown', async () => {
    const classifier = createClassifier();
    const scorer = createClassifierScorer<typeof classifier, 'quality'>({
      id: 'unknown-id-score',
      classifier: 'missing-classifier',
      question: 'quality',
      state: ({ run }) => run.output,
    });
    new Mastra({ classifiers: { classifier }, scorers: { scorer } });

    const error = await scorer.run({ output: 'answer' }).catch(err => err);
    expect(error).toBeInstanceOf(ScorerRunError);
    const lookupError = error.cause;
    expect(lookupError.message).toMatch(/Classifier 'missing-classifier' not found for scorer 'unknown-id-score'/);
    expect(lookupError.cause).toMatchObject({ message: expect.stringContaining('missing-classifier') });
  });

  it('validates choice score mappings at runtime', () => {
    const classifier = createClassifier();
    expect(() =>
      createClassifierScorer({
        id: 'invalid-map',
        classifier,
        question: 'route',
        scores: { correct: 1 } as any,
        state: ({ run }) => run.output,
      }),
    ).toThrow(/Missing: partial, incorrect/);
  });

  it('rejects choice scores outside 0-1', () => {
    expect(() =>
      createClassifierScorer({
        id: 'out-of-range',
        classifier: createClassifier(),
        question: 'route',
        scores: { correct: 2, partial: 0.5, incorrect: -1 },
        state: ({ run }) => run.output,
      }),
    ).toThrow(/Outside 0-1: correct, incorrect/);
  });

  it('scores an agent-shaped run with a real classifier', async () => {
    const doEvaluate = vi.fn(async () => ({
      answers: { factual: { type: 'boolean' as const, probability: 0.9 } },
      usage: { inputTokens: 4, outputTokens: 2 },
      warnings: [],
    }));
    const classifier = new Classifier({
      id: 'agent-judge',
      model: { ...createModel(), doEvaluate },
      questions: { factual: questions.factual },
    });
    const scorer = createClassifierScorer({
      id: 'agent-factual',
      type: 'agent',
      classifier,
      question: 'factual',
      state: ({ run }) => ({
        output: run.output.map(message =>
          message.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''),
        ),
      }),
    });

    const result = await scorer.run({
      input: { inputMessages: [], rememberedMessages: [], systemMessages: [], taggedSystemMessages: {} },
      output: [
        {
          id: 'msg-1',
          role: 'assistant',
          createdAt: new Date('2026-09-19T00:00:00.000Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'Paris is the capital of France.' }] },
        },
      ],
    });

    expect(result.score).toBe(0.9);
    expect(doEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({ state: { output: ['Paris is the capital of France.'] } }),
    );
  });

  it.each([
    ['a plain policy record', { policy: 'cite sources' }, 'cite sources'],
    ['a RequestContext with a policy', new RequestContext([['policy', 'cite sources']]), 'cite sources'],
    ['a RequestContext without a policy', new RequestContext(), null],
    ['no request context', undefined, null],
  ])('scores the documented policy state with %s', async (_label, requestContext, policy) => {
    const doEvaluate = vi.fn(async () => ({
      answers: { factual: { type: 'boolean' as const, probability: 0.9 } },
      usage: { inputTokens: 4, outputTokens: 2 },
      warnings: [],
    }));
    const classifier = new Classifier({
      id: 'policy-judge',
      model: { ...createModel(), doEvaluate },
      questions: { factual: questions.factual },
    });
    const scorer = createClassifierScorer({
      id: 'policy-factual-state',
      classifier,
      question: 'factual',
      state: ({ run }) => ({
        policy:
          (run.requestContext instanceof RequestContext
            ? run.requestContext.get('policy')
            : run.requestContext?.policy) ?? null,
        output: run.output,
      }),
    });

    const result = await scorer.run({ output: 'answer', requestContext });

    expect(result.score).toBe(0.9);
    expect(doEvaluate).toHaveBeenCalledWith(expect.objectContaining({ state: { policy, output: 'answer' } }));
  });
});
