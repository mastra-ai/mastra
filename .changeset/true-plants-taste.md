---
'@mastra/core': patch
---

Exported the `RunEvalsResult` type so the return type of `runEvals` can be imported from `@mastra/core/evals/run`. This also fixes a type error introduced in #21143 where the type-level tests imported a type that was not exported.
