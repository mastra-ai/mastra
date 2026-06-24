---
'@mastra/core': minor
'@mastra/evals': patch
---

**Gates and verdict for `runEvals`**

New optional `gates` field accepts scorers that must score 1.0 for the run to pass. Scorers can now use a `{ scorer, threshold }` form to set pass/fail thresholds. `threshold` accepts a number (minimum) or `{ min, max }` for range-based checks (e.g. hallucination where high = bad). The result includes `verdict`, `gateResults`, and `thresholdResults`. Fully backward compatible.

```ts
import { runEvals } from '@mastra/core/evals';
import { checks } from '@mastra/evals/checks';

const result = await runEvals({
  data: [{ input: 'What is the weather?' }],
  target: weatherAgent,
  gates: [checks.calledTool('get_weather')],
  scorers: [
    { scorer: faithfulnessScorer, threshold: 0.7 },
    { scorer: hallucinationScorer, threshold: { max: 0.3 } },
  ],
});

result.verdict; // 'passed' | 'scored' | 'failed'
```
