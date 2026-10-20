---
'@mastra/client-js': patch
---

Fixed client tools that run after `approveToolCall` / `declineToolCall` on an agent without memory. The follow-up model call now sees the whole conversation: the original user message, the approved (or declined) tool call and its result. Before, it saw only the client tool call and its result.

`approveToolCallGenerate` and `declineToolCallGenerate` now run executable client tools the model calls after the decision, and then continue the conversation, the same way `generate` does. Before, they returned with `finishReason: 'tool-calls'` and never ran the client tool.

Pass `memory` to `approveToolCallGenerate` / `declineToolCallGenerate` to save that continuation to the thread:

```ts
await agent.approveToolCallGenerate({ runId, toolCallId, clientTools, memory: { thread: threadId, resource: resourceId } });
```
