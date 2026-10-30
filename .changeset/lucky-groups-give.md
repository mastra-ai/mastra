---
'@mastra/core': patch
---

Fixed supervisor agents losing track of which subagent tool paused. When a subagent's tool suspends or needs approval, the supervisor's `tool-call-suspended` and `tool-call-approval` chunks now include `delegatedToolCallId` and `delegatedToolName`. UIs can label each pause with the subagent tool that caused it and tell apart several pauses from the same delegation, including after reloading the conversation from memory. With nested delegation, the fields name the deepest tool call that paused. Keep using `toolCallId` to approve, decline, or resume. Fixes #28583.

```ts
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') {
    chunk.payload.toolCallId; // the supervisor's call to the subagent, use it to resume
    chunk.payload.delegatedToolCallId; // the subagent's own tool call that paused
    chunk.payload.delegatedToolName; // e.g. "ask"
  }
}
```
