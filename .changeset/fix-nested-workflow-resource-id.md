---
"@mastra/core": patch
---

Fixed nested workflows dropping `resourceId` when executed as a step of a parent workflow. Child workflow snapshots now preserve the parent run's resource association, so tenant-scoped persistence works end-to-end. Closes [#15246](https://github.com/mastra-ai/mastra/issues/15246).

```ts
const run = await parent.createRun({
  runId: 'run-1',
  resourceId: 'workspace-1',
});

await run.start({ inputData: { ok: true } });
// Before: child snapshots persisted with resourceId: undefined
// After:  child snapshots persisted with resourceId: 'workspace-1'
```
