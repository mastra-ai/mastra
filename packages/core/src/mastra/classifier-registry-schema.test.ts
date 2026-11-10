import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';
import { Classifier } from '../classifier';
import type { WorkflowRegistryIndex } from '../workflows/dynamic';
import { Mastra } from './index';

const validator = vi.hoisted(() => ({ indexes: [] as unknown[] }));

vi.mock('../workflows/dynamic', async importOriginal => {
  const actual = await importOriginal<typeof import('../workflows/dynamic')>();
  return {
    ...actual,
    assertValidDynamicWorkflow: (...args: Parameters<typeof actual.assertValidDynamicWorkflow>) => {
      validator.indexes.push(args[1]);
      return actual.assertValidDynamicWorkflow(...args);
    },
  };
});

const model: EvaluationModelV4 = {
  specificationVersion: 'v4',
  provider: 'test-provider',
  modelId: 'test-model',
  supportedQuestionTypes: ['choice', 'score', 'boolean'],
  doEvaluate: async () => ({ answers: {}, usage: { inputTokens: 1, outputTokens: 1 }, warnings: [] }),
};

describe('Mastra workflow registry classifier schemas', () => {
  it('advertises refusal as a valid answer for every question type', async () => {
    const classifier = new Classifier({
      id: 'triage',
      model,
      questions: {
        route: { type: 'choice', criteria: { billing: 'Billing', support: 'Support' } },
        quality: { type: 'score', criteria: ['Poor', 'Good'] },
        unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
      },
    });
    const mastra = new Mastra({ logger: false, classifiers: { triage: classifier } });

    await mastra.addDynamicWorkflow({
      id: 'classify',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      outputSchema: {},
      graph: [{ type: 'classifier', id: 'classify', classifierId: 'triage' }],
    });

    const index = validator.indexes.at(-1) as WorkflowRegistryIndex;
    const answers = (index.classifiers?.triage?.outputSchema as any).properties.answers.properties;
    for (const [questionId, questionType] of [
      ['route', 'choice'],
      ['quality', 'score'],
      ['unsafe', 'boolean'],
    ]) {
      expect(answers[questionId].properties.type.enum).toEqual([questionType, 'refusal']);
      expect(answers[questionId].required).toEqual(['type']);
      expect(answers[questionId].description).toContain("{ type: 'refusal' }");
    }
    expect(answers.route.properties.choice.enum).toEqual(['billing', 'support']);
  });
});
