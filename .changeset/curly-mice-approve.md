---
'@mastra/core': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'mastra': patch
---

Added subscription-native tool approval APIs so approving or declining a tool call resumes through the active thread subscription instead of requiring a separate continuation stream. New messages are queued while a tool approval is waiting, preventing overlapping runs from duplicating approval requests.

```ts
await agent.sendToolApproval({
  resourceId: 'user-123',
  threadId: 'thread-123',
  toolCallId: 'tool-call-123',
  approved: true,
});
```
