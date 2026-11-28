---
'@mastra/core': minor
---

Added configurable step budgets for AgentController sessions. Set `maxSteps` on the controller to apply the same limit to initial runs and resumed continuations.

```typescript
const controller = new AgentController({
  id: 'assistant-controller',
  agent,
  maxSteps: 100,
  modes,
})
```

The default remains 1,000 steps.
