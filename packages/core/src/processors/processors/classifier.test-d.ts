import { expectTypeOf } from 'vitest';

import type { TripWireOptions } from '../../agent/trip-wire';
import { Classifier } from '../../classifier';
import type { BooleanAnswer, ChoiceAnswer, ClassifierDecisionIds, RefusalAnswer, ScoreAnswer } from '../../classifier';
import type { RequestContext } from '../../request-context';
import { ClassifierProcessor } from './classifier';

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

// Instance: answers inferred from the classifier's questions.
new ClassifierProcessor({
  classifier: configured,
  onResult: (answers, { abort, filter, phase, result }) => {
    expectTypeOf(answers.route).toEqualTypeOf<ChoiceAnswer<'support' | 'sales'> | RefusalAnswer>();
    expectTypeOf(answers.quality).toEqualTypeOf<ScoreAnswer | RefusalAnswer>();
    expectTypeOf(answers.unsafe).toEqualTypeOf<BooleanAnswer | RefusalAnswer>();
    if (result.answers.route.type === 'choice') {
      expectTypeOf(result.answers.route.choice).toEqualTypeOf<'support' | 'sales'>();
    }
    expectTypeOf(phase).toEqualTypeOf<'input' | 'output' | 'stream'>();
    expectTypeOf(abort).toEqualTypeOf<(reason?: string, options?: Pick<TripWireOptions, 'metadata'>) => never>();
    expectTypeOf(filter).toEqualTypeOf<() => void>();
    if (answers.unsafe.type === 'refusal' || answers.unsafe.probability > 0.8) abort('blocked');
  },
});

// Abort carries tripwire metadata. `retry` is rejected: these phases never retry.
new ClassifierProcessor({
  classifier: configured,
  onResult: (answers, { abort }) => {
    if (answers.unsafe.type === 'boolean' && answers.unsafe.probability > 0.8) {
      abort('blocked', { metadata: { question: 'unsafe', probability: answers.unsafe.probability } });
      // @ts-expect-error retry has no effect for ClassifierProcessor
      abort('blocked', { retry: true });
    }
  },
});

// onDecision receives typed answers and either a result or an error.
new ClassifierProcessor({
  classifier: configured,
  onResult: () => {},
  onDecision: decision => {
    expectTypeOf(decision.outcome).toEqualTypeOf<'allowed' | 'filtered' | 'aborted'>();
    expectTypeOf(decision.phase).toEqualTypeOf<'input' | 'output' | 'stream'>();
    expectTypeOf(decision.ids).toEqualTypeOf<ClassifierDecisionIds>();
    expectTypeOf(decision.requestContext).toEqualTypeOf<RequestContext | undefined>();
    if (decision.result) {
      expectTypeOf(decision.result.answers.unsafe).toEqualTypeOf<BooleanAnswer | RefusalAnswer>();
    } else {
      expectTypeOf(decision.error).toEqualTypeOf<unknown>();
    }
  },
});

// Async handler.
new ClassifierProcessor({
  classifier: configured,
  onResult: async (answers, { filter }) => {
    if (answers.quality.type === 'score' && answers.quality.score < 0.3) filter();
  },
});

// Classifier without configured questions is rejected.
const bare = new Classifier({ id: 'bare', model });
// @ts-expect-error classifier must have configured questions
new ClassifierProcessor({ classifier: bare, onResult: () => {} });

// onResult is required.
// @ts-expect-error onResult is required
new ClassifierProcessor({ classifier: configured });

// Registered id: answers fall back to the generic map unless Q is supplied.
new ClassifierProcessor({ classifier: 'safety', onResult: () => {} });
new ClassifierProcessor<{ unsafe: { type: 'boolean' } }>({
  classifier: 'safety',
  onResult: (answers, { abort }) => {
    expectTypeOf(answers.unsafe).toEqualTypeOf<BooleanAnswer | RefusalAnswer>();
    if (answers.unsafe.type === 'boolean' && answers.unsafe.probability > 0.5) abort('blocked');
  },
});
