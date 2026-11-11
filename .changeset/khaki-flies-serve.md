---
'@mastra/core': patch
---

Fixed evented workflows replacing omitted or `null` input with `{}`, matching the default engine. Fixes [#29424](https://github.com/mastra-ai/mastra/issues/29424).

- `start()`, `startAsync()` and `stream()`: an omitted `inputData` now lets the `inputSchema` default apply, and an explicit `null` reaches a nullable `inputSchema`.
- Resume: a suspended step gets the same `null` or omitted input it started with.
- Failures: a step that fails in a run started with `null` input no longer leaves `start()` waiting forever.
- `timeTravel()` to the first step, or to a nested workflow's first step, replays the run's `null` or omitted input. New `inputData` passed to `timeTravel()`, including `null`, replaces the stored input.

If you relied on that `{}` fallback, pass `inputData: {}` explicitly or add a schema default. Without an `inputSchema` or with `validateInputs: false`, the first step now receives `undefined` instead of `{}` when `inputData` is omitted, as on the default engine.

```ts
// Before: the evented engine passed {} when inputData was omitted
await run.start({});

// After: pass {} yourself, or give the inputSchema a default
await run.start({ inputData: {} });
const inputSchema = z.object({ count: z.number() }).default({ count: 0 });
```
