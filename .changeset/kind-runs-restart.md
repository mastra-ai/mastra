---
'@mastra/core': minor
---

Allow active workflow run discovery and restart to be scoped by `resourceId`, while preserving the existing no-argument behavior.

```ts
await workflow.restartAllActiveWorkflowRuns({ resourceId: 'user-123' })
```
