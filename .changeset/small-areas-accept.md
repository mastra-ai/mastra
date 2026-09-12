---
'@mastra/core': patch
---

Fixed session snapshots to restore current tasks from thread storage on startup and thread switches, without replaying message history. New and cloned threads start with empty tasks and zero usage. Snapshots now identify their thread.

Failed task hydration now releases a new session's lock and leaves an existing session on its previous thread, with its runtime snapshot and subscription intact. Retrying session creation or switching can then restore the requested thread. Optional preference failures no longer clear restored tasks or usage.

Removed `session.displayState.restoreTasks()` from the Beta Session API. Current tasks are restored by the session, not by the renderer.

Before:

```ts
session.displayState.restoreTasks(replayedTasks);
```

After:

```ts
const tasks = session.displayState.get().tasks;
```
