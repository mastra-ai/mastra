---
'@mastra/core': minor
---

Added per-run controls for experiment and score persistence. Targets and scorers continue to run, while callers can keep results in memory without writing selected record types to storage.

```typescript
const summary = await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'my-agent',
  scorers: ['accuracy'],
  persistence: { experiments: 'none', scores: 'none' },
});
```
