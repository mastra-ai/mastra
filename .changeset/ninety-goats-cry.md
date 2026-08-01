---
'@mastra/core': minor
---

Added a `reason` parameter to the `declineToolCall` and `declineToolCallGenerate` options on `Agent` and `DurableAgent` to support custom rejection reasons when declining tool calls.

**Usage Example:**

```typescript
// Decline a suspended tool call with a custom explanation
await agent.declineToolCall({
  runId: output.runId,
  toolCallId: 'call-xyz',
  reason: 'Declined due to insufficient user privileges',
});
```
