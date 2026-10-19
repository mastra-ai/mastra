---
'@mastra/core': patch
---

Fixed a TypeScript error (TS2345) when chaining processor steps with `.then()`, for example the guardrails docs example `.then(createStep(new TokenLimiterProcessor(...))).then(createStep(new BatchPartsProcessor()))`. Steps created with `createStep(processor)` now accept the output of the previous processor step.

The tool-result phase field that holds the tool's return value is now typed as `toolResultValue` (previously `result`), matching the field the runtime already reads.
