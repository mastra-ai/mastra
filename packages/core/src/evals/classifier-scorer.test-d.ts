import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';

import { Classifier } from '../classifier';
import { createClassifierScorer } from './classifier-scorer';

declare const model: EvaluationModelV4;

const classifier = new Classifier({
  id: 'response-judge',
  model,
  questions: {
    route: {
      type: 'choice',
      criteria: { correct: 'Correct', partial: 'Partially correct', incorrect: 'Incorrect' },
    },
    quality: {
      type: 'score',
      criteria: ['Poor', 'Good'],
    },
    factual: {
      type: 'boolean',
      criteria: { true: 'Factual', false: 'Not factual' },
    },
  },
});

const choiceScorer = createClassifierScorer({
  id: 'route-score',
  classifier,
  question: 'route',
  scores: { correct: 1, partial: 0.5, incorrect: 0 },
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

type ChoiceRun = Parameters<typeof choiceScorer.run>[0];
declare const choiceRun: ChoiceRun;
const choiceResult = await choiceScorer.run(choiceRun);
const choiceEvidence = choiceResult.analyzeStepResult!;
expectTypeOf(choiceResult.score).toEqualTypeOf<number | undefined>();
expectTypeOf(choiceEvidence.answer.choice).toEqualTypeOf<'correct' | 'partial' | 'incorrect'>();
expectTypeOf(choiceEvidence.answer.probabilities).toEqualTypeOf<
  Record<'correct' | 'partial' | 'incorrect', number> | undefined
>();

createClassifierScorer({
  id: 'quality-score',
  classifier,
  question: 'quality',
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});
createClassifierScorer({
  id: 'factual-score',
  classifier,
  question: 'factual',
  type: 'trajectory',
  state: () => 'trajectory',
});

const registeredScorer = createClassifierScorer<typeof classifier, 'quality'>({
  id: 'registered-score',
  classifier: 'response-judge',
  question: 'quality',
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});
type RegisteredRun = Parameters<typeof registeredScorer.run>[0];
declare const registeredRun: RegisteredRun;
const registeredResult = await registeredScorer.run(registeredRun);
expectTypeOf(registeredResult.analyzeStepResult!.question).toEqualTypeOf<'quality'>();
expectTypeOf(registeredResult.analyzeStepResult!.answer.score).toEqualTypeOf<number>();

const customScorer = createClassifierScorer({
  id: 'custom-score',
  classifier,
  question: 'factual',
  type: {
    input: z.object({ prompt: z.string() }),
    output: z.object({ response: z.string() }),
  },
  state: ({ run, results, mastra }) => {
    expectTypeOf(run.input).toEqualTypeOf<{ prompt: string } | undefined>();
    expectTypeOf(run.output).toEqualTypeOf<{ response: string }>();
    expectTypeOf(results).toEqualTypeOf<Record<string, never>>();
    expectTypeOf(mastra).not.toBeNever();
    return { input: run.input, output: run.output };
  },
});
void customScorer;

// @ts-expect-error choice questions require scores
createClassifierScorer({
  id: 'missing-map',
  classifier,
  question: 'route',
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

createClassifierScorer({
  id: 'incomplete-map',
  classifier,
  question: 'route',
  // @ts-expect-error choice score mappings must be exhaustive
  scores: { correct: 1, partial: 0.5 },
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

createClassifierScorer({
  id: 'extra-map',
  classifier,
  question: 'route',
  // @ts-expect-error choice score mappings reject unknown keys
  scores: { correct: 1, partial: 0.5, incorrect: 0, unknown: 2 },
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

createClassifierScorer({
  id: 'invalid-score-map',
  classifier,
  question: 'quality',
  // @ts-expect-error score questions do not accept choice mappings
  scores: { low: 0 },
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

createClassifierScorer({
  id: 'invalid-boolean-map',
  classifier,
  question: 'factual',
  // @ts-expect-error boolean questions do not accept choice mappings
  scores: { true: 1, false: 0 },
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

createClassifierScorer({
  id: 'unknown-question',
  classifier,
  // @ts-expect-error selected question must exist on the configured classifier
  question: 'unknown',
  type: 'agent',
  state: ({ run }) => ({ messages: run.output.length }),
});

const unconfiguredClassifier = new Classifier({ id: 'unconfigured', model });
// @ts-expect-error state is required
createClassifierScorer({ id: 'missing-state', classifier, question: 'factual', type: 'agent' });

createClassifierScorer({
  id: 'unconfigured-score',
  // @ts-expect-error scorer adapters require constructor-configured classifier questions
  classifier: unconfiguredClassifier,
  question: 'quality',
  state: () => '',
});
