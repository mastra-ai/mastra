---
'@mastra/memory': patch
---

Added an optional `{ threadId, resourceId }` scope to `settled()`. With a scope it waits only for that thread's observational memory background work, so a busy thread no longer holds up callers waiting on a different thread that shares the same engine. Calling `settled()` with no scope still waits for all work.

```ts
await memory.settled({ threadId, resourceId });
```
