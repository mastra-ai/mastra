---
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
---

Add `/api/agents/:agentId/stream-until-idle` SSE route that mirrors the new `agent.streamUntilIdle()` method. The route keeps the SSE stream open through background task completion and the agent's follow-up turn, so clients receive the final answer in a single request. Also added matching `MastraClient` method to the agent client - `agent.streamUntilIdle()`

```ts
const stream = await client.getAgent('my-agent').streamUntilIdle({
  messages: 'Research quantum computing',
});
for await (const chunk of stream) {
  /* ... */
}
```
