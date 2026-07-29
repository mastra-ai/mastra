---
'@mastra/factory': minor
---

Added a per-Factory Slack work-item setting so a new Slack thread only opens a Work-board card when that Factory opts in, and Slack OAuth now returns to the Factory the flow started from.

```ts
// Opt a Factory into Work-board cards for new Slack threads.
await fetch(`/web/factory/projects/${factoryProjectId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ slackWorkItemsEnabled: true }),
});
```
