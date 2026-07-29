---
'@mastra/core': minor
---

Added `unmockedToolPolicy` to experiments and dataset items so undeclared agent tool calls can be blocked before execution.

```typescript
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'weather-agent',
  unmockedToolPolicy: 'deny',
});
```
