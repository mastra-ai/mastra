---
'@mastra/pg': minor
---

Added PostgreSQL persistence for workflow snapshot handoffs, including transactional mutation fencing, a durable completed marker, and a bounded recovery index.

```ts
await workflows.claimWorkflowSnapshotHandoff({
  workflowName,
  runId,
  snapshot,
  mutationFence,
});
```

