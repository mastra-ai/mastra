---
'@mastra/libsql': minor
---

`LibSQLStore` now keeps pending agent signals in the memory domain. A signal sent to a thread is stored in the messages table under the reserved thread ID `mastra-pending-signals:<threadId>` until the thread's run takes it, and becomes a normal message of the thread when that run saves it. Message reads, `updateMessages` and thread cloning never return a signal that is still pending. Thread IDs that start with `mastra-pending-signals:` are rejected. Processes share the stored signals when the store opens a file or a remote database. In-memory databases, embedded replicas and a local client passed as `client` keep them to one process.

```ts
const storage = new LibSQLStore({ id: 'my-store', url: 'file:./mastra.db' });
const memory = await storage.getStore('memory');
memory?.supportsPendingSignals; // true
memory?.pendingSignalsSharedAcrossProcesses; // true for a file or a remote database
```

`init()` adds two nullable columns to existing databases, `signalClaimedBy` on `mastra_messages` and `signalRunId` on `mastra_threads`, and a partial index on the messages a run has taken: `CREATE INDEX IF NOT EXISTS idx_messages_signal_claimed ON mastra_messages (thread_id, "createdAt", id) WHERE "signalClaimedBy" IS NOT NULL`. Existing messages and threads are unchanged. Message reads and saves don't use the new columns, so a store created with `disableInit: true` keeps serving them before the migration; it needs `init()` (or your own migration) run against the database before it sends or claims pending signals.

Requires `@mastra/core` 1.87.0 or later.
