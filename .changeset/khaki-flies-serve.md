---
'@mastra/core': patch
---

Fixed evented workflows rejecting valid input in `start()`, `startAsync()` and `stream()`. An omitted `inputData` now lets the workflow `inputSchema` default apply, and an explicit `null` now reaches a nullable `inputSchema`, matching the default engine. Before, the evented engine replaced both with `{}` before validation. Fixes [#29424](https://github.com/mastra-ai/mastra/issues/29424).

If you relied on that `{}` fallback, pass `inputData: {}` explicitly or add a schema default. Without an `inputSchema` or with `validateInputs: false`, the first step now receives `undefined` instead of `{}` when `inputData` is omitted, as on the default engine.
