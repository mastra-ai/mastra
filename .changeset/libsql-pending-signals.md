---
'@mastra/libsql': minor
---

`LibSQLStore` now keeps pending agent signals in the memory domain. A signal sent to a thread is stored as a hidden row of the messages table until the thread's run takes it, and becomes a normal message when that run saves it. Message reads, `updateMessages` and thread cloning ignore signals that are still pending. Processes share the stored signals when the store opens a file or a remote database. In-memory databases, embedded replicas and a local client passed as `client` keep them to one process.

```ts
const storage = new LibSQLStore({ id: 'my-store', url: 'file:./mastra.db' });
const memory = await storage.getStore('memory');
memory?.supportsPendingSignals; // true
memory?.pendingSignalsSharedAcrossProcesses; // true for a file or a remote database
```

`init()` adds three nullable columns to existing databases, `signalStatus` and `signalClaimedBy` on `mastra_messages` and `signalRunId` on `mastra_threads`, and an index on the rows that hold signals. Existing messages and threads are unchanged. Message reads use the new columns, so a store created with `disableInit: true` must have `init()` (or your own migration) run against the database before it serves reads after the upgrade. Message reads name the index, so a migration of your own must also create it, or every such read fails: `CREATE INDEX IF NOT EXISTS idx_messages_thread_signal ON mastra_messages (thread_id, "createdAt", id) WHERE ("signalStatus" IS NOT NULL OR "signalClaimedBy" IS NOT NULL)`.
