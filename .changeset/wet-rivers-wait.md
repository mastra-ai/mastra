---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Added an optional `reason` when declining a tool call, so the model and your UI can see _why_ a tool call was rejected instead of always showing "Tool call was not approved by the user".

```ts
// Before: the model only learned the call was declined
await agent.declineToolCall({ runId, toolCallId });

// After: give the model context it can act on
await agent.declineToolCall({
  runId,
  toolCallId,
  reason: 'Reading other users personal data is not allowed, ask the user for their own email instead',
});
```

The reason is retained with the tool call, so it is still there when the conversation is recalled later. It is supported by `declineToolCall`, `declineToolCallGenerate` and `declineNetworkToolCall`, on both regular and durable agents. Omitting `reason` keeps the previous default message.

Closes #20495
