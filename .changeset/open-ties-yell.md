---
'@mastra/core': patch
---

Fixed workflow runs whose `dowhile` or `dountil` condition throws.

**Default engine:** `run.start()` used to reject with the error and the run stayed `running` in storage. It now resolves with the failed run, and the run and its loop step are stored as failed.

```ts
const result = await run.start({ inputData });
// before: rejects with "condition boom", the stored run stays "running"
// after:  result.status === 'failed', result.error.message === 'condition boom'
```

**Evented engine:** the condition and a step used as the loop body ran up to three times before the run failed. A `foreach` concurrency function that throws had the same problem. The run now fails on the first error, and a nested workflow used as the loop body keeps its successful status.

Agent loops are unchanged: a throwing `stopWhen` still rejects the stream.
