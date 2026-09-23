import { expectTypeOf } from 'vitest';

import { Classifier, type BooleanAnswer, type ChoiceAnswer } from '../../classifier';
import { ModelSelectionProcessor } from './model-selection';

declare const model: ConstructorParameters<typeof Classifier>[0]['model'];

const triage = new Classifier({
  id: 'triage',
  model,
  questions: {
    complexity: { type: 'choice', criteria: { trivial: 'Trivial', complex: 'Complex' } },
    sensitive: { type: 'boolean' },
  },
});

// Instance: answers inferred from the classifier's questions.
new ModelSelectionProcessor({
  classifier: triage,
  select: ({ complexity, sensitive }, { result }) => {
    expectTypeOf(complexity).toEqualTypeOf<ChoiceAnswer<'trivial' | 'complex'>>();
    expectTypeOf(sensitive).toEqualTypeOf<BooleanAnswer>();
    expectTypeOf(result.answers.complexity.choice).toEqualTypeOf<'trivial' | 'complex'>();
    if (sensitive.probability > 0.3) return undefined;
    return complexity.choice === 'trivial' ? 'openai/gpt-4o-mini' : undefined;
  },
});

// A misspelled choice is a type error.
new ModelSelectionProcessor({
  classifier: triage,
  // @ts-expect-error 'trivail' is not a choice of this question
  select: ({ complexity }) => (complexity.choice === 'trivail' ? 'openai/gpt-4o-mini' : undefined),
});

// Registered id: explicit questions type the answers.
new ModelSelectionProcessor<{ complexity: { type: 'choice'; criteria: { low: string; high: string } } }>({
  classifier: 'triage',
  select: ({ complexity }) => {
    expectTypeOf(complexity.choice).toEqualTypeOf<'low' | 'high'>();
    return undefined;
  },
});

// Choices form.
new ModelSelectionProcessor({
  model,
  choices: [
    { model: 'openai/gpt-4o-mini', criteria: 'Simple' },
    { model: 'openai/gpt-4o', criteria: 'Hard' },
  ],
});
