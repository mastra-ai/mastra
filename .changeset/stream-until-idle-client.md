---
'@mastra/client-js': patch
---

Add `streamUntilIdle` to the agent client, mirroring the new server route. The client keeps the SSE connection open through background task completion and the agent's follow-up turn, and preserves the `/stream-until-idle` endpoint across client-tool continuations.

```ts
const stream = await client.getAgent('my-agent').streamUntilIdle({
  messages: 'Research quantum computing',
});
for await (const chunk of stream) {
  /* ... */
}
```
