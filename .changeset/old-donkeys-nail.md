---
'@mastra/connect': minor
---

Added `requestConnections` so an agent can ask the user to connect an integration, or install a channel, from the chat. When a task needs an allowlisted provider that isn't connected yet, or one that needs reconnecting, the agent calls a new `connect_integration` tool. The user gets a Connect link, and the agent continues the same thread once the connection succeeds or fails. The continued run is in the same trace, nested under the tool span in exporters that support external parents.

```ts
const connectTools = tools({
  providers: ['linear', 'github'],
  requestConnections: {
    allow: ({ requestContext }) => requestContext.get('role') === 'member',
    channels: ['slack-channels'],
  },
});

const agent = new Agent({
  id: 'ops',
  name: 'ops',
  instructions: 'You help the team track work in Linear and GitHub.',
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  tools: connectTools,
  signals: [connectTools.signalProvider()],
});

new Mastra({ agents: { agent }, storage, server: { apiRoutes: connectTools.routes() } });
```

Agents without `requestConnections` are unchanged. The option needs a `providers` allowlist or `channels`, agent memory, and a storage with a `notifications` domain. Connections belong to the project. Anyone who clicks the link adds a connection for the whole project, so use `requestConnections.allow(ctx)` to limit who can trigger it. Outside `mastra dev`, set `MASTRA_CONNECT_WEBHOOK_URL` and `MASTRA_CONNECT_WEBHOOK_SECRET`.

This release requires `@mastra/core` 1.76.0 or later.
