---
'@mastra/evals': minor
---

Add `@mastra/evals/vitest` for running `runEvals` evaluations as Vitest tests. `expectScores`/`expectScore` fail the test when the eval doesn't pass, custom matchers (`toHaveVerdict`, `toHaveScoreAbove`, `toHaveScoreBelow`, `toPassGates`, `toPassThresholds`) are registerable via `@mastra/evals/vitest/setup`, and `MastraEvalsReporter` prints a per-test score table in the runner output. Vitest 3 or 4 is an optional peer dependency; the root package is unaffected when Vitest is not installed.

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
