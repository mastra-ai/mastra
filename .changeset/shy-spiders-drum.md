---
'@mastra/core': minor
---

Added execution-engine configuration with `Agent.durable.executionEngine` and `Mastra.durable` defaults. Explicit agent settings take precedence over registered defaults, the engine selection locks at registration or first execution, and editor forks preserve the selected policy without changing a wrapped agent's engine.

```typescript
const mastra = new Mastra({
  durable: { executionEngine: 'durable' },
  agents: { support: agent },
})
```

This change provides configuration and policy resolution; native engine dispatch is supplied by the companion execution change. Release the two changes together.
