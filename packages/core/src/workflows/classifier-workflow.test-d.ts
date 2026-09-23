import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';

import { Classifier, type BooleanAnswer, type ChoiceAnswer, type ScoreAnswer } from '../classifier';
import { createWorkflow } from './create';
import type { Step } from './step';
import { createStep } from './workflow';

const model = null as unknown as EvaluationModelV4;
const questions = {
  route: { type: 'choice', criteria: { billing: 'Billing', support: 'Support' } },
  quality: { type: 'score', criteria: ['Low', 'High'] },
  urgent: { type: 'boolean', criteria: { true: 'Urgent', false: 'Not urgent' } },
} as const;
const classifier = new Classifier({ id: 'ticket-router', model, questions });

const step = createStep(classifier);
type StepOutput<T> = T extends Step<any, any, any, infer OUTPUT, any, any, any> ? OUTPUT : never;
type Output = StepOutput<typeof step>;
expectTypeOf<Output['answers']['route']>().toEqualTypeOf<ChoiceAnswer<'billing' | 'support'>>();
expectTypeOf<Output['answers']['quality']>().toEqualTypeOf<ScoreAnswer>();
expectTypeOf<Output['answers']['urgent']>().toEqualTypeOf<BooleanAnswer>();

createWorkflow({
  id: 'typed-classifier',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.any(),
})
  .classifier(classifier)
  .branch([
    [
      async ({ inputData }) => {
        expectTypeOf(inputData.answers.route).toEqualTypeOf<ChoiceAnswer<'billing' | 'support'>>();
        return inputData.answers.route.choice === 'billing';
      },
      createStep({
        id: 'billing',
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData }) => inputData,
      }),
    ],
  ]);

const unconfigured = new Classifier({ id: 'unconfigured', model });
// @ts-expect-error workflow classifier steps require constructor-configured questions
createStep(unconfigured);
// @ts-expect-error fluent workflow classifier entries require constructor-configured questions
createWorkflow({ id: 'invalid', inputSchema: z.string(), outputSchema: z.any() }).classifier(unconfigured);

createWorkflow({ id: 'registered', inputSchema: z.string(), outputSchema: z.any() }).classifier<typeof questions>(
  'ticket-router',
);
