---
'@mastra/core': patch
---

Restored persisted task lists when reopening a controller thread and added a subscriber-local `task_snapshot` bootstrap. Snapshots distinguish loading, unavailable storage, and a valid empty list. Live `task_updated` events now include their source `threadId`; stale reads and old-thread updates cannot replace current tasks.

```typescript
session.subscribe(event => {
  if (event.type === 'task_snapshot' && event.snapshot.status === 'ready') {
    console.log(event.snapshot.threadId, event.snapshot.tasks)
  }
})
```
