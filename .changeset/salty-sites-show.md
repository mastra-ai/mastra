---
'@mastra/core': minor
'@mastra/evals': patch
---

Added gates and verdict to `runEvals`. New optional `gates` field accepts scorers that must score 1.0 for the run to pass. Scorers can now use a `{ scorer, threshold }` form to set pass/fail thresholds. The result includes a `verdict` field (`'passed'` | `'scored'` | `'failed'`), `gateResults`, and `thresholdResults`. Fully backward compatible — existing calls without gates/thresholds work unchanged.
