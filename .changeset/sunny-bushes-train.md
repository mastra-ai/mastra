---
'@mastra/core': minor
---

Suspended background tool calls can now be answered after a reload.

**Open request saved on the tool call.** While a deferred background tool is suspended, the assistant message that holds the call keeps the open request in `metadata.suspendedTools[toolCallId]` (with `suspendPayload`, `taskId`, and `suspendedAt`). The entry is removed when the task resumes or is cancelled, so a chat that reloads the thread shows only requests that are still open.

**Resumed tools see what they asked for.** A resumed background tool now receives the payload it suspended with in `context.agent.suspendPayload`, the same as a foreground tool:

```typescript
execute: async (input, context) => {
  const { resumeData, suspendPayload, suspend } = context.agent;
  if (!resumeData) return suspend?.({ question: 'Approve the refund?' });
  // suspendPayload is { question: 'Approve the refund?' }
};
```
