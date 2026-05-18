---
"@mastra/core": minor
---

Added guarded deletion for Harness sessions.

Thread deletion now removes the owning Harness session subtree only after active work has been closed and storage ownership has been verified.

Deletion is now guarded across concurrent operations and storage backends.
`threads.delete(...)` now fails when ownership cannot be proven, which prevents unsafe deletes.
If a thread is attached to external session storage, it is marked as externally owned so other processes cannot delete it by mistake.

```ts
await harness.threads.delete({
  resourceId: 'project-xyz',
  threadId: thread.id,
});
```
