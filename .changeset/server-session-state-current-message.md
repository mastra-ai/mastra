---
'@mastra/server': patch
---

The agent-controller session state route now returns `currentMessage`, the assistant message of the turn in flight on the requested thread, so a client that connects while a run is mid-step can draw what has streamed so far. The field is absent when the session is idle or another thread is requested.

```ts
const response = await fetch(`/api/agent-controller/code/sessions/${resourceId}?threadId=${threadId}`);
const { running, currentMessage } = await response.json();
if (running && currentMessage) drawStreaming(currentMessage.content.parts);
```
