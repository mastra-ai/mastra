---
'@mastra/core': patch
---

Added `AgentController.setThreadModel` to change a session thread's model without recreating the session. A running session bound to the thread switches immediately; otherwise the model is saved for its next run.

```ts
const { live } = await controller.setThreadModel({
  resourceId: 'session-1',
  threadId: 'thread-1',
  modelId: 'openai/gpt-5.6',
});
```
