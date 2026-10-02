---
'@mastra/temporal': patch
---

Fixed workflow lifecycle hooks being silently ignored for Temporal-backed workflows. `onStart`, `onFinish`, and `onError` from a workflow's `options` now run when you call `start()` or `startAsync()`, with the same rules as other Mastra workflows: `onStart` runs before the run is sent to Temporal and rejects the call if it throws, `onFinish` runs for every finished run, `onError` runs only for failed runs, and errors thrown from `onFinish` or `onError` are logged instead of failing the run.

The hooks run in the process that started the run, not on the Temporal worker. With `startAsync()`, `onFinish` and `onError` run in the background when the Temporal run completes, so they don't fire if that process exits first.
