import { expectTypeOf } from 'vitest';

import { Classifier, type BooleanAnswer, type ChoiceAnswer, type ScoreAnswer } from '../../classifier';
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
    expectTypeOf(answers.route).toEqualTypeOf<ChoiceAnswer<'support' | 'sales'>>();
    expectTypeOf(answers.quality).toEqualTypeOf<ScoreAnswer>();
    expectTypeOf(answers.unsafe).toEqualTypeOf<BooleanAnswer>();
    expectTypeOf(result.answers.route.choice).toEqualTypeOf<'support' | 'sales'>();
    expectTypeOf(phase).toEqualTypeOf<'input' | 'output' | 'stream'>();
    expectTypeOf(abort).toEqualTypeOf<(reason?: string) => never>();
    expectTypeOf(filter).toEqualTypeOf<() => void>();
    if (answers.unsafe.probability > 0.8) abort('blocked');
  },
});

// Async handler.
new ClassifierProcessor({
  classifier: configured,
  onResult: async (answers, { filter }) => {
    if (answers.quality.score < 0.3) filter();
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
    expectTypeOf(answers.unsafe).toEqualTypeOf<BooleanAnswer>();
    if (answers.unsafe.probability > 0.5) abort('blocked');
  },
});
