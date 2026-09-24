---
'@mastra/core': patch
'@mastra/inngest': patch
'@mastra/temporal': patch
---

Fixed `run.cancel()` leaving nested workflow runs active after a process restart. Canceling a saved parent run now also cancels its saved child and grandchild workflow runs that are still running, suspended, waiting, or pending, on both the default and evented engines. Runs that already finished are left unchanged.

`run.cancel()` now returns `{ failed }`, listing any run whose cancellation could not be saved, instead of only logging the error:

```ts
const { failed } = await run.cancel();
if (failed.length) {
  // retry or alert: failed[i].workflowName, failed[i].runId, failed[i].error
}
```

On the evented engine, canceling a run recreated after a restart now also tells workers that are still executing it to stop.
