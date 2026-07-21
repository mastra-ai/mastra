---
'@mastra/core': minor
---

The 'workers' option on the Mastra class now merges with the default workers instead of replacing them. Passing custom workers (e.g. a polling worker for an integration) no longer silently drops the built-in orchestration and background-task workers — a custom worker only replaces a default when it shares its name, and 'workers: false' still disables all workers.

```ts
const mastra = new Mastra({
  // before: only myPoller ran — orchestration was dropped
  // after: myPoller runs alongside the default workers
  workers: [myPoller],
});
```
