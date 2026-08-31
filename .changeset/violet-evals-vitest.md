---
'@mastra/evals': minor
---

Add `@mastra/evals/vitest` subpath for running `runEvals` evaluations as Vitest tests. Includes `evalTest` (declares a test that fails when the eval verdict is `failed`), `expectItems(...).toPass(minPassRate?)` (fluent assertion inside a regular `test()` requiring a minimum per-gate pass rate across data items), custom matchers (`toHaveVerdict`, `toHaveScoreAbove`, `toHaveScoreBelow`, `toPassGates`, `toPassThresholds`) registerable via `@mastra/evals/vitest/setup`, and `MastraEvalsReporter` which prints a per-test score table in the runner output. `vitest` (v3+) is an optional peer dependency; the root package is unaffected when Vitest is not installed.
