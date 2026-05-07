---
'@mastra/core': minor
---

**Why**

One bot can serve multiple groups or tenants while keeping each conversation tied to a specific agent (narrow tools / RBAC). Follow-up messages and tool approvals stay on that agent instead of quietly switching back to the channel owner.

**How to use**

```typescript
const channels = mastra.getAgent('router').getChannels()!;
await channels.handleWebhookEvent('slack', request, {
  agent: mastra.getAgent('complianceSupervisor'),
});
```

Pass only agents registered on the same `Mastra` instance. If the override id or stored thread metadata cannot be resolved, processing errors rather than falling back to the owner agent.
