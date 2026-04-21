---
'@mastra/client-js': minor
---

Added `forEachIndex` option to `run.resume()`, `run.resumeAsync()`, and `run.resumeStream()`. Use it to resume a single iteration of a suspended `.foreach()` step while leaving the other iterations suspended.

```ts
await client
  .getWorkflow('myWorkflow')
  .createRun(runId)
  .resume({
    step: 'approve',
    resumeData: { ok: true },
    forEachIndex: 1, // only resume the second iteration
  });
```
