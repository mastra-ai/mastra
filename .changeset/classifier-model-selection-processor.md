---
'@mastra/core': minor
---

Added `ModelSelectionProcessor`, which picks the model for each request with a classifier. Keep a capable model as the agent's default and let simple requests run on a cheaper one.

Describe each model and the requests it should handle. The processor builds the classifier for you:

```ts
import { Agent } from '@mastra/core/agent';
import { ModelSelectionProcessor } from '@mastra/core/processors';

// `model` is the evaluation model that makes the decision (`EvaluationModelV4 | MastraEvaluationModel`, the same type Classifier accepts).
new Agent({
  name: 'support-agent',
  model: 'openai/gpt-5.6-sol',
  inputProcessors: [
    new ModelSelectionProcessor({
      model,
      choices: [
        { model: 'openai/gpt-5-mini', criteria: 'Answerable in one or two sentences with no reasoning steps' },
        { model: 'openai/gpt-5.6-sol', criteria: 'Requires multi-step reasoning or careful judgment' },
      ],
      onDecision: decision => console.log('model selection', decision),
    }),
  ],
});
```

To use a `Classifier` you already have, pass it as `classifier` and map its typed answers to a model with `select`.

Routing doesn't always save money. Models don't share prompt caches, and a cheaper model can take more steps. Measure cost and quality on your own traffic first.

**Behavior**

- The chosen model serves the whole run. Set `scope: 'first-step'` to change only the first call.
- If the classifier fails, the agent's configured model is used.
- If the chosen model fails, the agent's fallback models take over.
- With `minProbability` set, the configured model is used when the confidence is too low or missing.
