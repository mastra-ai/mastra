---
'@mastra/core': minor
---

Added framework-native workflow snapshot handoff records with opaque mutation fences, exact snapshot compare-and-set transitions, completion sentinels, and bounded recovery enumeration.

```ts
await workflows.claimWorkflowSnapshotHandoff({
  workflowName,
  runId,
  snapshot,
  mutationFence,
});
```
