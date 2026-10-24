---
'@mastra/temporal': patch
---

Fixed workflow lifecycle hooks being silently ignored for Temporal-backed workflows. `onStart`, `onFinish`, and `onError` from a workflow's `options` now run when you call `start()` or `startAsync()`, with the same rules as other Mastra workflows: `onStart` runs before the run is sent to Temporal and rejects the call if it throws, `onFinish` runs for every finished run, `onError` runs only for failed runs, and errors thrown from `onFinish` or `onError` are logged instead of failing the run.

The hooks run in the process that started the run, not on the Temporal worker. With `startAsync()`, `onFinish` and `onError` run in the background when the Temporal run completes, so they don't fire if that process exits first.

`run.start()` now also returns the workflow output in `result` and the step results in `steps`, instead of nesting the whole Temporal execution result inside `result` with empty `steps`. If you read the output from `result.result.result`, read it from `result.result` instead:

```ts
const result = await run.start({ inputData });

// Before
const output = result.result.result;

// After
const output = result.result;
const stepResults = result.steps;
```

Each entry in `result.steps` (and in the `steps` passed to `onFinish`/`onError`) now uses the standard step result shape, so read a step's output from `.output`:

```ts
const doubled = result.steps.double.output;
```

Request context values set in `onStart` are now sent to the Temporal workflow.
