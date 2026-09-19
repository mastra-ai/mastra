---
'@mastra/core': minor
---

Add `ModelRouterProcessor` for classifier-backed model routing. It classifies the incoming request once and overrides the model for the agent's first step, so a capable model stays configured as the default while cheap requests get downgraded.

```ts
import { Classifier } from '@mastra/core/classifier';
import { ModelRouterProcessor } from '@mastra/core/processors';

const triage = new Classifier({
  id: 'triage',
  model,
  questions: {
    complexity: {
      type: 'choice',
      criteria: {
        trivial: 'Answerable in one or two sentences with no reasoning steps',
        complex: 'Requires multi-step reasoning or careful judgment',
      },
    },
  },
});

new Agent({
  name: 'support-agent',
  model: 'openai/gpt-5.6-sol',
  inputProcessors: [
    new ModelRouterProcessor({
      classifier: triage,
      question: 'complexity',
      models: {
        trivial: 'openai/gpt-5-mini',
        complex: 'openai/gpt-5.6-sol',
      },
    }),
  ],
});
```

Pass `select` instead of `question`/`models` to route on several questions at once. Routing fails open to the agent's configured model on classifier error, and `minProbability` fails closed when the evaluation model returns no probability for a choice answer.
