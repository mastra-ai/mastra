import { expectTypeOf } from 'vitest';

import { Classifier, type BooleanAnswer, type ChoiceAnswer, type ScoreAnswer } from '../../classifier';
import { ClassifierProcessor, type ClassifierDecide, type ClassifierDecision } from './classifier';

declare const model: ConstructorParameters<typeof Classifier>[0]['model'];

const configured = new Classifier({
  id: 'configured',
  model,
  questions: {
    route: { type: 'choice', criteria: { support: 'Support', sales: 'Sales' } },
    quality: { type: 'score', criteria: ['Low', 'High'] },
    unsafe: { type: 'boolean' },
  },
});

// Configured classifier: answers inferred from the classifier, questions not allowed.
new ClassifierProcessor({
  classifier: configured,
  decide: (answers, ctx) => {
    expectTypeOf(answers.route).toEqualTypeOf<ChoiceAnswer<'support' | 'sales'>>();
    expectTypeOf(answers.quality).toEqualTypeOf<ScoreAnswer>();
    expectTypeOf(answers.unsafe).toEqualTypeOf<BooleanAnswer>();
    expectTypeOf(ctx.phase).toEqualTypeOf<'input' | 'output' | 'stream'>();
    expectTypeOf(ctx.result.answers.route.choice).toEqualTypeOf<'support' | 'sales'>();
    return { action: 'pass' };
  },
});

new ClassifierProcessor({
  // @ts-expect-error configured classifiers cannot receive processor-level questions
  classifier: configured,
  questions: { unsafe: { type: 'boolean' } },
  decide: () => ({ action: 'pass' }),
});

// Per-call classifier: questions required, answers inferred from them.
const perCall = new Classifier({ id: 'per-call', model });

new ClassifierProcessor({
  classifier: perCall,
  questions: { topic: { type: 'choice', criteria: { billing: 'Billing', other: 'Other' } } },
  decide: answers => {
    expectTypeOf(answers.topic).toEqualTypeOf<ChoiceAnswer<'billing' | 'other'>>();
    return { action: 'pass' };
  },
});

// @ts-expect-error questions are required when the classifier has none configured
new ClassifierProcessor({ classifier: perCall, decide: () => ({ action: 'pass' }) });

// Registered id: questions optional.
new ClassifierProcessor({ classifier: 'safety', decide: () => ({ action: 'pass' }) });
new ClassifierProcessor({
  classifier: 'safety',
  questions: { unsafe: { type: 'boolean' } },
  decide: answers => {
    expectTypeOf(answers.unsafe).toEqualTypeOf<BooleanAnswer>();
    return { action: 'block', reason: 'blocked' };
  },
});

// Decision shape is enforced.
// @ts-expect-error block requires a reason
const invalidDecide: ClassifierDecide<typeof configured.questions> = () => ({ action: 'block' });
void invalidDecide;

expectTypeOf<ClassifierDecision>().toEqualTypeOf<
  { action: 'pass' } | { action: 'block'; reason: string } | { action: 'filter' }
>();
