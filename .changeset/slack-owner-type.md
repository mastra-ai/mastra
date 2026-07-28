---
'@mastra/slack': minor
---

Slack connections can now be owned by an `AgentController`, not just a registered `Agent`. Call `connect` with an options object to connect an owner that has no registered agent:

```typescript
await mastra.channels.slack.connect({
  id: 'my-controller',
  name: 'Support Bot',
});
```

Installations record an `ownerType` (`'agent'` by default, or `'agentController'`). Inbound Slack events and OAuth callbacks route to the owning `AgentController`'s channels when `ownerType` is `'agentController'`, so mentions and messages drive a controller session. Existing agent-owned installations are unaffected.
