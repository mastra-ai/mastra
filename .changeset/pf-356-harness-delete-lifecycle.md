---
"@mastra/core": patch
---

Added guarded session deletion for Harness sessions.

Deleting a thread now removes the owning session subtree after safely closing active work.

```ts
await harness.deleteSession({
  sessionId: session.id,
  resourceId: 'project-xyz',
  force: true,
});
```
