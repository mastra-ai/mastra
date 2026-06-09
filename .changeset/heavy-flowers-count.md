---
'@mastra/core': patch
---

Fixed per-item request context being dropped for inline experiment data. When running an experiment with inline `data`, each item's `requestContext` is now passed to the agent or workflow and merged over the global request context (per-item values win on key collisions), matching the behavior of storage-backed datasets.

```ts
await dataset.startExperiment({
  data: [{ input: { prompt: 'Hello' }, requestContext: { clinicId: 'clinic-1' } }],
  targetType: 'agent',
  targetId: 'support-agent',
});
// Tools can now read clinicId from requestContext during inline experiments
```
