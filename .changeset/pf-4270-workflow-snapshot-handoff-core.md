---
'@mastra/core': minor
---

Added workflow snapshot handoffs. You can claim a workflow run, update its handed-off snapshot, and mark the handoff complete. While a handoff exists, ordinary workflow writes to that run are rejected. You can list pending handoffs to resume them after a restart.

```ts
await workflows.claimWorkflowSnapshotHandoff({
  workflowName,
  runId,
  expectedCanonical: { kind: 'absent' },
  snapshot,
  mutationFence,
});
```
