---
'@mastra/core': minor
---

Added `.send()` method to the Agent class — a higher-level orchestration method that wraps `stream()` with event emission, abort handling, and error recovery.

`.send()` emits lifecycle events (`send_start`, `send_end`), message events (`message_start`, `message_update`, `message_end`), tool events (`tool_start`, `tool_end`, `tool_approval_required`), and usage events (`usage_update`) so UIs can subscribe and react.

Also adds `abort()` to cancel in-progress sends and `respondToToolApproval()` for interactive tool approval flows.

```typescript
agent.subscribe(event => {
  if (event.type === 'message_update') console.log(event.message);
});

const { message } = await agent.send({
  messages: 'Hello!',
  threadId: 'thread-1',
  resourceId: 'user-1',
});

// Cancel:
agent.abort();
```
