---
'@mastra/core': minor
---

Added Azure OpenAI Responses WebSocket transport support for streaming agent and tool loops.

Configure the Azure gateway with `useResponsesAPI: true`, then opt into WebSocket streaming per request:

```ts
const stream = await agent.stream('Review this task', {
  providerOptions: {
    azure: {
      transport: 'websocket',
      websocket: { closeOnFinish: false },
    },
  },
});
```
