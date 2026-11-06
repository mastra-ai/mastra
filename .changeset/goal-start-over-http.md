---
'@mastra/server': patch
'@mastra/client-js': patch
---

Setting or resuming an agent controller goal over HTTP can now start the agent working on it. Pass `start: true` to `session.setGoal()` or `session.updateGoal()` and the server sends the agent the goal as a reminder, so a turn starts right away instead of the goal sitting unused until the next message. If the goal can't start, it is paused.

```ts
await session.setGoal('Migrate the billing service to the new API', { start: true });
```
