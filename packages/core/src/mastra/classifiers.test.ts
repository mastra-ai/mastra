import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';
import { Classifier } from '../classifier';
import { MastraError } from '../error';
import type { ObservabilityEntrypoint, ObservabilityInstance } from '../observability';
import { Mastra } from './index';

function createModel(): EvaluationModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test-provider',
    modelId: 'test-model',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    doEvaluate: async () => ({
      answers: { unsafe: { type: 'boolean', probability: 0.1 } },
      usage: { inputTokens: 1, outputTokens: 1 },
      warnings: [],
    }),
  };
}

const questions = {
  unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
} as const;

function createObservability() {
  const startSpan = vi.fn();
  const instance = { startSpan } as unknown as ObservabilityInstance;
  const entrypoint = {
    setLogger: vi.fn(),
    setMastraContext: vi.fn(),
    getDefaultInstance: vi.fn(() => instance),
    getSelectedInstance: vi.fn(() => instance),
  } as unknown as ObservabilityEntrypoint;

  return { entrypoint, startSpan };
}

describe('Mastra classifier registration', () => {
  it('registers classifiers from config and exposes them by key and id', () => {
    const safety = new Classifier({ id: 'safety-classifier', model: createModel(), questions });
    const router = new Classifier({ id: 'router', model: createModel() });
    const mastra = new Mastra({ classifiers: { safety, router } });

    expect(Object.keys(mastra.listClassifiers())).toEqual(['safety', 'router']);
    expect(mastra.getClassifier('safety')).toBe(safety);
    expect(mastra.getClassifierById('safety-classifier')).toBe(safety);
    // Falls back to the registration key
    expect(mastra.getClassifierById('safety')).toBe(safety);
    expect(mastra.getClassifierById('router')).toBe(router);
  });

  it('uses the registered Mastra observability instance for root spans', async () => {
    const registered = new Classifier({ id: 'registered', model: createModel(), questions });
    const unregistered = new Classifier({ id: 'unregistered', model: createModel(), questions });
    const { entrypoint, startSpan } = createObservability();
    new Mastra({ classifiers: { registered }, observability: entrypoint });

    await registered.evaluate({ state: 'test' });
    expect(startSpan).toHaveBeenCalledOnce();

    await unregistered.evaluate({ state: 'test' });
    expect(startSpan).toHaveBeenCalledOnce();
  });

  it('addClassifier uses the id as the default key and ignores duplicate keys', () => {
    const mastra = new Mastra();
    const first = new Classifier({ id: 'safety', model: createModel(), questions });
    const second = new Classifier({ id: 'safety', model: createModel(), questions });

    mastra.addClassifier(first);
    mastra.addClassifier(second);

    expect(mastra.getClassifier('safety')).toBe(first);
    expect(Object.keys(mastra.listClassifiers())).toEqual(['safety']);
  });

  it('throws MastraError with 404 status for unknown classifiers', () => {
    const mastra = new Mastra();

    expect(() => mastra.getClassifier('missing')).toThrow(MastraError);
    expect(() => mastra.getClassifier('missing')).toThrow(/Classifier with missing not found/);
    expect(() => mastra.getClassifierById('missing')).toThrow(MastraError);

    try {
      mastra.getClassifierById('missing');
    } catch (error) {
      expect(error).toBeInstanceOf(MastraError);
      expect((error as MastraError).id).toBe('MASTRA_GET_CLASSIFIER_BY_ID_NOT_FOUND');
      expect((error as MastraError).details.status).toBe(404);
    }
  });

  it('removes classifiers by key or id', () => {
    const mastra = new Mastra({
      classifiers: {
        safety: new Classifier({ id: 'safety-classifier', model: createModel(), questions }),
        router: new Classifier({ id: 'router-classifier', model: createModel() }),
      },
    });

    expect(mastra.removeClassifier('safety')).toBe(true);
    expect(mastra.removeClassifier('router-classifier')).toBe(true);
    expect(mastra.removeClassifier('missing')).toBe(false);
    expect(Object.keys(mastra.listClassifiers())).toEqual([]);
  });

  it('rebinds a classifier to the latest Mastra instance', async () => {
    const classifier = new Classifier({ id: 'safety', model: createModel(), questions });
    const first = createObservability();
    const second = createObservability();
    new Mastra({ classifiers: { safety: classifier }, observability: first.entrypoint });
    new Mastra({ classifiers: { safety: classifier }, observability: second.entrypoint });

    await classifier.evaluate({ state: 'test' });

    expect(first.startSpan).not.toHaveBeenCalled();
    expect(second.startSpan).toHaveBeenCalledOnce();
  });

  it('throws when adding an undefined classifier', () => {
    const mastra = new Mastra();
    expect(() => mastra.addClassifier(undefined as any, 'safety')).toThrow(MastraError);
  });
});
