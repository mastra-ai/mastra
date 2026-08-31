---
'@mastra/evals': minor
---

Add `@mastra/evals/vitest` for running `runEvals` evaluations as Vitest tests.

- `expectScores`/`expectScore` fail the test when the eval doesn't pass.
- Optional custom matchers (`toHaveVerdict`, `toHaveScoreAbove`, `toHaveScoreBelow`, `toPassGates`, `toPassThresholds`) via `@mastra/evals/vitest/setup`.
- `MastraEvalsReporter` prints per-test scores in the runner output.

```ts
import { test } from 'vitest';
import { expectScores } from '@mastra/evals/vitest';

test('capitals agent answers with the expected city', { timeout: 60_000 }, async () => {
  await expectScores({
    target: capitalsAgent,
    data: [{ input: 'What is the capital of France?', groundTruth: 'Paris' }],
    gates: [containsGroundTruth],
  }).toPass();
});
```
