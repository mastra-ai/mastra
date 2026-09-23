---
'@mastra/core': minor
---

Add `ModelSelectionProcessor` for classifier-backed model routing. It classifies the incoming request once and overrides which model serves the run, so a capable model stays configured as the default while cheap requests get downgraded.

Describe each model alongside the requests it should handle, and the processor builds the classifier for you:

```ts
import { Agent } from '@mastra/core/agent';
import { ModelSelectionProcessor } from '@mastra/core/processors';

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
      onDecision: decision => logger.info('model routing', decision),
    }),
  ],
});
```

`onDecision` reports which model was chosen, the confidence behind it, and why the router abstained when it did.

Routing isn't guaranteed to save money. Prompt caches aren't shared between models, so switching models pays full price for the conversation again, and a cheaper model can take more steps. Measure total cost and quality on your own traffic before enabling it.

Pass a `classifier` you already own instead of `choices` to route on an existing `Classifier`, with `select` mapping its answers to a model. Routing applies to the whole run by default; `scope: 'first-step'` routes only the opening call. Routing fails open to the agent’s configured model on classifier error, agent fallback models still take over if the selected model fails, and `minProbability` fails closed when the evaluation model returns no distribution for a choice answer.
