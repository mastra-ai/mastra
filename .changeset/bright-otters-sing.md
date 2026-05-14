---
'@mastra/core': minor
---

Added the first runnable Harness v1 session lifecycle in `@mastra/core`.

- `new Harness(config)` validates configured modes and agents at construction.
- `harness.session(...)` can find or create a live session, acquire its durable write lease, and return a `Session` instance.
- `session.close()`, `harness.closeSession(...)`, `harness.listSessions(...)`, `harness.loadSession(...)`, and `harness.shutdown()` now work, including parent/child cascade and lease release on shutdown.
- Message, queue, attachment, thread, and interval slices still land separately.

```ts
const harness = new Harness(config);
await harness.init();

const session = await harness.session({
  resourceId: 'user-1',
  threadId: { fresh: true },
});

await session.close();
await harness.shutdown();
```
