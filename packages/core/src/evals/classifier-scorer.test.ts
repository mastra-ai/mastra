import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';

import { Classifier } from '../classifier';
import { Mastra } from '../mastra';
import { createClassifierScorer, projectClassifierScore } from './classifier-scorer';

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

  it('projects score and boolean answers directly', async () => {
    const scoreClassifier = createClassifier();
    vi.spyOn(scoreClassifier, 'evaluate').mockResolvedValue(mockResult({ type: 'score', score: 1.75 }) as any);
    const scoreScorer = createClassifierScorer({
      id: 'quality-score',
      classifier: scoreClassifier,
      question: 'quality',
    });

    const booleanClassifier = createClassifier();
    vi.spyOn(booleanClassifier, 'evaluate').mockResolvedValue(
      mockResult({ type: 'boolean', probability: 0.37 }) as any,
    );
    const booleanScorer = createClassifierScorer({
      id: 'factual-score',
      classifier: booleanClassifier,
      question: 'factual',
    });

    await expect(scoreScorer.run({ output: 'answer' })).resolves.toMatchObject({ score: 1.75 });
    await expect(booleanScorer.run({ output: 'answer' })).resolves.toMatchObject({ score: 0.37 });
  });

  it('uses run.output by default and forwards classifier options', async () => {
    const classifier = createClassifier();
    const evaluate = vi
      .spyOn(classifier, 'evaluate')
      .mockResolvedValue(mockResult({ type: 'boolean', probability: 0.8 }) as any);
    const scorer = createClassifierScorer({
      id: 'factual-score',
      classifier,
      question: 'factual',
      maxRetries: 4,
      providerOptions: { test: { mode: 'fast' } },
    });

    await scorer.run({ output: { text: 'answer' } });

    expect(evaluate).toHaveBeenCalledWith({
      state: { text: 'answer' },
      abortSignal: expect.any(AbortSignal),
      maxRetries: 4,
      providerOptions: { test: { mode: 'fast' } },
    });
  });

  it('resolves registered classifier IDs at run time', async () => {
    const classifier = createClassifier();
    vi.spyOn(classifier, 'evaluate').mockResolvedValue(mockResult({ type: 'score', score: 0.9 }) as any);
    const scorer = createClassifierScorer<typeof classifier>({
      id: 'registered-score',
      classifier: 'response-judge',
      question: 'quality',
    });
    new Mastra({ classifiers: { classifier }, scorers: { scorer } });

    await expect(scorer.run({ output: 'answer' })).resolves.toMatchObject({ score: 0.9 });
  });

  it('fails actionably when an ID-backed scorer is not registered', async () => {
    const classifier = createClassifier();
    const scorer = createClassifierScorer<typeof classifier>({
      id: 'unregistered-score',
      classifier: 'missing-classifier',
      question: 'quality',
    });

    await expect(scorer.run({ output: 'answer' })).rejects.toThrow(
      /Classifier 'missing-classifier' for scorer 'unregistered-score'.*not registered with Mastra/,
    );
  });

  it('validates choice score mappings at runtime', () => {
    const classifier = createClassifier();
    expect(() =>
      createClassifierScorer({
        id: 'invalid-map',
        classifier,
        question: 'route',
        scores: { correct: 1 } as any,
      }),
    ).toThrow(/Missing: partial, incorrect/);
  });
});

describe('projectClassifierScore', () => {
  it('does not clamp caller-owned scores', () => {
    expect(projectClassifierScore({ type: 'score', score: 4.5 })).toBe(4.5);
    expect(projectClassifierScore({ type: 'boolean', probability: 0.42 })).toBe(0.42);
    expect(projectClassifierScore({ type: 'choice', choice: 'high' }, { high: 2 })).toBe(2);
  });
});
