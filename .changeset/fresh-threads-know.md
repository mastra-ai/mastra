---
'@mastra/core': minor
---

Added a `threadCreated` flag to `AgentController.onSessionCreated` listeners. Listeners now receive a second `context` argument whose `threadCreated` flag tells you whether the session created its bound thread (`true`, so the thread only holds creation-time defaults) or not (`false`, because it resumed an existing thread or has no bound thread).

```ts
controller.onSessionCreated(async (session, { threadCreated }) => {
  if (threadCreated) await session.model.switch('anthropic/claude-sonnet-4-5');
});
```
