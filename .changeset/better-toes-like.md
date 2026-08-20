---
'@mastra/evals': minor
---

Added `createMultiTurnJudgeScorer` to `@mastra/evals/scorers/prebuilt`, an LLM judge that grades a whole multi-turn conversation against a plain-English criterion.

The other prebuilt LLM judges read a single assistant message, so they cannot grade a conversation run with the multi-turn `inputs` form of `runEvals`. This scorer reads every assistant turn accumulated in `run.output` and returns 1 when the criterion is satisfied, otherwise 0.

```typescript
import { runEvals } from '@mastra/core/evals';
import { createMultiTurnJudgeScorer } from '@mastra/evals/scorers/prebuilt';

const result = await runEvals({
  data: [{ inputs: ["How's the weather in London?", 'And Paris?', 'Should I pack an umbrella?'] }],
  target: weatherAgent,
  scorers: [
    {
      scorer: createMultiTurnJudgeScorer({
        model: 'anthropic/claude-haiku-4-5',
        criterion: 'The agent gave forecasts for London and Paris, and weather-appropriate packing advice.',
      }),
      threshold: 1,
    },
  ],
});
```
