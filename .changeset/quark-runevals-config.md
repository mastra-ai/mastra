---
'@mastra/core': patch
---

Export `RunEvalsConfig`, the widest configuration type accepted by `runEvals` across all overloads, so helpers that forward options to `runEvals` (like `@mastra/evals/vitest`) can type them without duplicating the shape.
