---
'@mastra/core': minor
'@mastra/deployer': patch
'mastra': patch
---

Faster, configurable workflow recovery on server boot.

- Active workflow runs now restart in parallel (up to 5 at a time by default) instead of one by one, and durable agent recovery no longer waits for the workflow sweep.
- New `recovery.workflows: 'off'` turns off boot-time workflow restarts for the whole instance; `recovery.workflowConcurrency` sets the parallelism (`Infinity` for no limit).
- `workflow.restartAllActiveWorkflowRuns()` also restarts runs concurrently, capped by `recovery.workflowConcurrency`. Set it to `1` if runs share side effects that must not overlap.

```ts
new Mastra({
  recovery: { workflows: 'auto', workflowConcurrency: 10 },
});
```
