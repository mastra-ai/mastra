---
'@mastra/core': minor
---

Added `AgentController.editMessage()` to start an edited copy of a saved conversation while keeping the original available. Earlier messages and attachments are retained. The new thread rebuilds its conversation summary; shared resource memory remains shared.

```ts
const newThreadId = crypto.randomUUID()
const edited = await controller.editMessage({
  resourceId: 'user-1',
  sourceThreadId: 'original-thread',
  messageId: 'message-to-edit',
  content: 'The corrected message',
  newThreadId,
  newSessionScope: newThreadId,
})
```

Fixed durable model restoration losing the selected gateway. Saved routing identifiers now retain their gateway prefix without storing model credentials.
