---
'@mastra/core': patch
---

Added optional `targetVersionId` field to `ExperimentConfig` for pinning agent experiments to a specific version snapshot. This field only applies to agent targets (`targetType: 'agent'`) and is ignored for workflow and scorer targets.

**Before**

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'my-agent',
  scorers: [accuracy],
});
```

**After**

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'my-agent',
  targetVersionId: 'version-uuid-123', // pin to a specific agent version
  scorers: [accuracy],
});
```
