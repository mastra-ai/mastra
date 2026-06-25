---
'@mastra/core': patch
---

Deliver the `background-task-started` lifecycle chunk to the `onChunk` callback when an agent dispatches a tool as a background task. Previously the chunk was written to the agent stream but never passed to `onChunk`, so consumers could not observe the structured `{ taskId, toolName, toolCallId }` payload at dispatch time.

```ts
await agent.stream(prompt, {
  onChunk: chunk => {
    if (chunk.type === 'background-task-started') {
      // now fires — { taskId, toolName, toolCallId } available immediately
      subscribeToTask(chunk.payload.taskId);
    }
  },
});
```
