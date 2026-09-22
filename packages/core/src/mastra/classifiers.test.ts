import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';
import { Classifier } from '../classifier';
import { MastraError } from '../error';
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

  it('calls __registerMastra on registration', () => {
    const classifier = new Classifier({ id: 'safety', model: createModel(), questions });
    const spy = vi.spyOn(classifier, '__registerMastra');
    const mastra = new Mastra({ classifiers: { safety: classifier } });

    expect(spy).toHaveBeenCalledWith(mastra);
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

  it('throws when adding an undefined classifier', () => {
    const mastra = new Mastra();
    expect(() => mastra.addClassifier(undefined as any, 'safety')).toThrow(MastraError);
  });
});
