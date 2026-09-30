---
'@mastra/core': minor
'@mastra/code-sdk': patch
---

Fixed signals and notifications losing their request context when they wake an idle thread. A signal sent as a run finished could start the next run without the controller's context, failing with "No model available: controller session context".

Agents now accept a `wakeOptions` hook that builds options for the run a signal starts on an idle thread. It runs only when a run actually starts, so signals delivered to a live run skip it. Signal methods also accept a top-level `requestContext`, which is passed to the hook and used as the run's context when the hook returns none.

```ts
const agent = new Agent({
  // ...
  wakeOptions: async ({ resourceId, threadId, requestContext }) => ({ requestContext }),
});

await agent.sendNotificationSignal(notification, { resourceId, threadId, requestContext });
```

Agents managed by `AgentController` get a default hook that builds options from the owning session, so every wake path (sessions, notifications, schedules, GitHub signals) uses the same context.
