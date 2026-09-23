import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, expectTypeOf, it } from 'vitest';
import { Classifier } from '../classifier';
import { Mastra } from './index';

const model = null as unknown as EvaluationModelV4;
const questions = {
  unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
} as const;

describe('Mastra classifier registration types', () => {
  it('preserves registered classifier keys and answer types', async () => {
    const safety = new Classifier({ id: 'safety', model, questions });
    const mastra = new Mastra({ classifiers: { safety } });

    expectTypeOf(mastra.getClassifier('safety')).toEqualTypeOf<typeof safety>();

    // @ts-expect-error unknown classifier keys are rejected
    mastra.getClassifier('missing');

    const result = await mastra.getClassifier('safety').evaluate({ state: 'test' });
    expectTypeOf(result.answers.unsafe).toEqualTypeOf<{ type: 'boolean'; probability: number }>();
  });
});
