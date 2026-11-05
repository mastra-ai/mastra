---
'@mastra/core': patch
---

Fixed evented workflows rejecting valid input in `start()`, `startAsync()` and `stream()`. An omitted `inputData` now lets the workflow `inputSchema` default apply, and an explicit `null` now reaches a nullable `inputSchema`, matching the default engine. Before, the evented engine replaced both with `{}` before validation. Resuming a suspended step now also gives it the same `null` or omitted input it started with, and a step failure in a run started with `null` input no longer leaves `start()` waiting forever. Fixes [#29424](https://github.com/mastra-ai/mastra/issues/29424).

If you relied on that `{}` fallback, pass `inputData: {}` explicitly or add a schema default. Without an `inputSchema` or with `validateInputs: false`, the first step now receives `undefined` instead of `{}` when `inputData` is omitted, as on the default engine.

```ts
// Before: the evented engine passed {} when inputData was omitted
await run.start({});

// After: pass {} yourself, or give the inputSchema a default
await run.start({ inputData: {} });
const inputSchema = z.object({ count: z.number() }).default({ count: 0 });
```
