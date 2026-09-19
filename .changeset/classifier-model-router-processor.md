---
'@mastra/core': minor
---

Add `ModelRouterProcessor` for classifier-backed model routing. It classifies the incoming request once and overrides which model serves the run, so a capable model stays configured as the default while cheap requests get downgraded.

Describe each model alongside the requests it should handle, and the processor builds the classifier for you:

```ts
import { Agent } from '@mastra/core/agent';
import { ModelRouterProcessor } from '@mastra/core/processors';

new Agent({
  name: 'support-agent',
  model: 'openai/gpt-5.6-sol',
  inputProcessors: [
    new ModelRouterProcessor({
      model,
      choices: [
        { model: 'openai/gpt-5-mini', criteria: 'Answerable in one or two sentences with no reasoning steps' },
        { model: 'openai/gpt-5.6-sol', criteria: 'Requires multi-step reasoning or careful judgment' },
      ],
      onRoute: decision => logger.info('model routing', decision),
    }),
  ],
});
```

`onRoute` reports which model was chosen, the confidence behind it, and why the router abstained when it did.

Pass a `classifier` you already own instead of `choices` to route on an existing `Classifier`, using `question`/`models` for a single choice question or `select` to combine several questions at once. Routing applies to the whole run by default; `scope: 'first-step'` routes only the opening call. Routing fails open to the agent's configured model on classifier error, and `minProbability` fails closed when the evaluation model returns no distribution for a choice answer.
