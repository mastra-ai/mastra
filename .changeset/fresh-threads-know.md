---
'@mastra/core': minor
---

`AgentController.onSessionCreated` listeners now receive a second `context` argument. Its `threadCreated` flag tells you whether the session created its bound thread (so the thread only holds creation-time defaults) or resumed an existing one.

```ts
controller.onSessionCreated(async (session, { threadCreated }) => {
  if (threadCreated) await session.model.switch('anthropic/claude-sonnet-4-5');
});
```
