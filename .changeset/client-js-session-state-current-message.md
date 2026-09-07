---
'@mastra/client-js': patch
---

`session.state()` on an agent-controller session now returns `currentMessage`, the assistant message of the turn in flight, with its `createdAt` hydrated to a `Date` like the rows `listMessages()` returns.

```ts
const state = await session.state({ threadId });
if (state.running && state.currentMessage) {
  drawStreaming(state.currentMessage.content.parts);
}
```
