---
'@mastra/core': minor
---

Added `includeDefaultGateways` to `AgentController`. Set it to `false` so the model catalog and auth checks use only the gateways you pass, without the built-in gateways that read provider credentials from the process environment.

```typescript
const controller = new AgentController({
  id: 'tenant-controller',
  modes,
  gateways: [tenantGateway],
  includeDefaultGateways: false,
});
```

Added `modelFallbacks` to `AgentController`. Set it to `false` so runs never add provider-side fallback models, such as retrying a blocked `claude-fable-5` turn on `claude-opus-4-8`.

Added `registerAgents` to `AgentController`. Set it to `false` to keep backing agents out of `mastra.listAgents()` and the standard `/agents` server routes, so they only run through the controller. Unregistered agents don't take the `Mastra` instance's `durable` defaults, and deferred notification delivery can't resolve them.
