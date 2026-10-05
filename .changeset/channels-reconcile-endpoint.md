---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added an explicit reconcile step for channel installations whose connect flow finishes outside the app (for example Discord's bot invite, which never redirects back). Channel providers can implement the new optional `reconcileInstallation(agentId)` method, exposed over `POST /api/channels/:platform/:agentId/reconcile` and `client.channels.reconcileInstallation(platform, agentId)`. The route requires the same write access as connecting, and returns the agent's fresh installation — or `null` when the platform doesn't support reconciliation. Listing installations is now a pure read and never changes state.

```ts
const installation = await client.channels.reconcileInstallation('discord', 'my-agent');
// { id, platform, agentId, status: 'active', ... } once the invite completed
```
