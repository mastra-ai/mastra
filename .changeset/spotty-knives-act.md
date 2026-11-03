---
'@mastra/evals': patch
---

`@mastra/evals/vitest` now also supports Vitest 5. `expectEvals`, the score reporter, and the custom matchers (`toHaveVerdict`, `toHaveScoreAbove`, `toHaveScoreBelow`, `toPassGates`, `toPassThresholds`) work and are fully typed on Vitest 3, 4, and 5.
