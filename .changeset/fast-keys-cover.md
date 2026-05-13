---
'@mastra/core': patch
---

**Added**
You can now call `run.restart()` for evented workflows to continue execution from the latest persisted run state.

```ts
const run = workflow.createRun();
await run.start({ inputData: { jobId: 'job-123' } });

// Later, restart the same run from the last active step
await run.restart();
```
