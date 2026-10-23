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
