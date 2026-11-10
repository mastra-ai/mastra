---
'@mastra/core': patch
---

Fixed workflow runs whose `dowhile` or `dountil` condition, or `foreach` concurrency function, throws.

**Default engine:** `run.start()` used to reject with the error and the run stayed `running` in storage. It now resolves with the failed run, and the run and its step are stored as failed. Inngest workflows, which already failed the run, now also keep the results of the steps that ran and record the failed step.

```ts
const result = await run.start({ inputData });
// before: rejects with "condition boom", the stored run stays "running"
// after:  result.status === 'failed', result.error.message === 'condition boom'
```

**Evented engine:** the throwing function and a step used as the loop body ran up to three times before the run failed. The run now fails on the first error, and a nested workflow used as the loop body keeps its successful status.

A throwing `stopWhen` still rejects agent streams.
