---
'@mastra/core': minor
'@mastra/evals': patch
---

**Gates and verdict for `runEvals`**

New optional `gates` field accepts scorers that must score 1.0 for the run to pass. Scorers can now use a `{ scorer, threshold }` form to set pass/fail thresholds. The result includes `verdict`, `gateResults`, and `thresholdResults`. Fully backward compatible — existing calls without gates/thresholds work unchanged.

```ts
import { runEvals } from '@mastra/core/evals';
import { checks } from '@mastra/evals/checks';

const result = await runEvals({
  data: [{ input: 'What is the weather?' }],
  target: weatherAgent,
  gates: [checks.calledTool('get_weather')],
  scorers: [{ scorer: faithfulnessScorer, threshold: 0.7 }],
});

result.verdict; // 'passed' | 'scored' | 'failed'
```
