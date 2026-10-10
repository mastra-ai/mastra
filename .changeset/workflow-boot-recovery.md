---
'@mastra/core': patch
'@mastra/deployer': patch
'mastra': patch
'@mastra/pg': patch
---

Faster, configurable workflow recovery on server boot.

- Active workflow runs now restart in parallel (up to 5 at a time by default) instead of one by one, and durable agent recovery no longer waits for the workflow sweep.
- New `recovery.workflows: 'off'` turns off boot-time workflow restarts for the whole instance; `recovery.workflowConcurrency` sets the parallelism.

```ts
new Mastra({
  recovery: { workflows: 'auto', workflowConcurrency: 10 },
});
```

- `@mastra/pg` now logs a one-time warning when the workflow snapshot column is not `jsonb`, because status queries (including boot recovery) then scan the whole table.
