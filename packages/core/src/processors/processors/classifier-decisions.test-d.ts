import { expectTypeOf } from 'vitest';

import { Classifier } from '../../classifier';
import { ClassifierProcessor, type ClassifierDecide } from './classifier';
import { decisions } from './classifier-decisions';

declare const model: ConstructorParameters<typeof Classifier>[0]['model'];

const questions = {
  unsafe: { type: 'boolean' },
  route: { type: 'choice', criteria: { support: 'Support', sales: 'Sales' } },
  quality: { type: 'score', criteria: ['Bad', 'Good'] },
} as const;
type Q = typeof questions;

// Valid shapes narrow by question type.
expectTypeOf(decisions.blockIf<Q, 'unsafe'>('unsafe', { probability: 0.5, reason: 'r' })).toEqualTypeOf<
  ClassifierDecide<Q>
>();
decisions.blockIf<Q, 'route'>('route', { oneOf: ['sales'], reason: 'r' });
decisions.blockIf<Q, 'quality'>('quality', { scoreBelow: 0.5, reason: 'r', action: 'filter' });
decisions.blockUnless<Q, 'unsafe'>('unsafe', { probability: 0.5, reason: 'r' });
decisions.blockUnless<Q, 'route'>('route', { oneOf: ['support', 'sales'], reason: 'r' });
decisions.blockUnless<Q, 'quality'>('quality', { scoreAtLeast: 0.5, scoreAtMost: 1, reason: 'r' });

// Wrong shape for the question type is a compile error.
// @ts-expect-error boolean questions take `probability`, not `oneOf`
decisions.blockIf<Q, 'unsafe'>('unsafe', { oneOf: ['sales'], reason: 'r' });
// @ts-expect-error choice questions take `oneOf`, not `probability`
decisions.blockIf<Q, 'route'>('route', { probability: 0.5, reason: 'r' });
// @ts-expect-error score questions take `scoreBelow`/`scoreAbove`, not `probability`
decisions.blockIf<Q, 'quality'>('quality', { probability: 0.5, reason: 'r' });
// @ts-expect-error `oneOf` is narrowed to the question's option keys
decisions.blockIf<Q, 'route'>('route', { oneOf: ['billing'], reason: 'r' });
// @ts-expect-error unknown question key
decisions.blockIf<Q, 'missing'>('missing', { probability: 0.5, reason: 'r' });
// @ts-expect-error reason is required
decisions.blockIf<Q, 'unsafe'>('unsafe', { probability: 0.5 });
// @ts-expect-error blockUnless score options use `scoreAtLeast`/`scoreAtMost`
decisions.blockUnless<Q, 'quality'>('quality', { scoreBelow: 0.5, reason: 'r' });

// Q is inferred from the classifier when used inside ClassifierProcessor options.
const classifier = new Classifier({ id: 'c', model, questions });
new ClassifierProcessor({
  classifier,
  decide: decisions.blockIf('unsafe', { probability: 0.5, reason: 'r' }),
});
new ClassifierProcessor({
  classifier,
  decide: decisions.all(
    decisions.blockIf('unsafe', { probability: 0.5, reason: 'r' }),
    decisions.blockUnless('route', { oneOf: ['support'], reason: 'r' }),
  ),
});
new ClassifierProcessor({
  classifier,
  // @ts-expect-error option key must belong to the route question
  decide: decisions.blockUnless('route', { oneOf: ['billing'], reason: 'r' }),
});
