---
'@mastra/connect': minor
---

Added `requestConnections` so an agent can ask the user to connect an integration from the chat. When a task needs an allowlisted provider that isn't connected yet, or one that needs reconnecting, the agent calls a new `connect_integration` tool. The user gets a Connect link, and the agent continues the same thread once the connection succeeds or fails.

```ts
const connectTools = tools({
  providers: ['linear', 'github'],
  requestConnections: {
    allow: ({ requestContext }) => requestContext.get('role') === 'member',
  },
});

const agent = new Agent({ tools: connectTools, signals: [connectTools.signalProvider()] });

new Mastra({ agents: { agent }, server: { apiRoutes: [connectTools.webhookRoute()] } });
```

Agents without `requestConnections` are unchanged. The option needs a `providers` allowlist, agent memory, and a storage with a `notifications` domain. Outside `mastra dev`, set `MASTRA_CONNECT_WEBHOOK_URL` and `MASTRA_CONNECT_WEBHOOK_SECRET`.

This release requires `@mastra/core` 1.76.0 or later.
