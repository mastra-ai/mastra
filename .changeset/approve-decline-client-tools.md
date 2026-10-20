---
'@mastra/client-js': patch
'@mastra/server': patch
---

Fixed client tools failing with `ToolNotFoundError` after a tool approval. `approveToolCall`, `declineToolCall`, `approveToolCallGenerate` and `declineToolCallGenerate` now accept `clientTools` (and `clientToolsResolver`) and send them to the server, so the model can call a client tool after the approval decision. `approveToolCall` and `declineToolCall` also accept `memory`; pass the same thread and resource as the original call so client-tool results and the final answer are saved to that thread.

```ts
const stream = await agent.approveToolCall({
  runId,
  toolCallId,
  clientTools,
  memory: { thread: threadId, resource: resourceId },
});
```
