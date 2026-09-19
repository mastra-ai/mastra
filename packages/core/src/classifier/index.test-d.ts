import { expectTypeOf } from 'vitest';

import { Classifier, type BooleanAnswer, type ChoiceAnswer, type ScoreAnswer } from './index';

declare const model: ConstructorParameters<typeof Classifier>[0]['model'];

const configured = new Classifier({
  id: 'configured',
  model,
  questions: {
    route: {
      type: 'choice',
      criteria: { support: 'Support', sales: 'Sales' },
    },
    quality: {
      type: 'score',
      criteria: ['Low', 'High'],
    },
    unsafe: {
      type: 'boolean',
      criteria: { true: 'Unsafe', false: 'Safe' },
    },
  },
});

const configuredResult = await configured.evaluate({ state: 'content' });
expectTypeOf(configuredResult.answers.route).toEqualTypeOf<ChoiceAnswer<'support' | 'sales'>>();
expectTypeOf(configuredResult.answers.quality).toEqualTypeOf<ScoreAnswer>();
expectTypeOf(configuredResult.answers.unsafe).toEqualTypeOf<BooleanAnswer>();
// @ts-expect-error configured classifiers cannot receive per-call questions
configured.evaluate({ state: 'content', questions: { unsafe: { type: 'boolean' } } });

const perCall = new Classifier({ id: 'per-call', model });
const perCallResult = await perCall.evaluate({
  state: { content: 'hello' },
  questions: {
    route: {
      type: 'choice',
      criteria: { docs: 'Documentation', support: 'Support' },
    },
  },
});
expectTypeOf(perCallResult.answers.route).toEqualTypeOf<ChoiceAnswer<'docs' | 'support'>>();
// @ts-expect-error per-call classifiers require questions
perCall.evaluate({ state: 'content' });
