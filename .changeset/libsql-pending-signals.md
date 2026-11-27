---
'@mastra/libsql': minor
---

`LibSQLStore` now keeps pending agent signals in the memory domain. A signal sent to a thread is stored in the messages table under the reserved thread ID `mastra-queue:pending:<threadId>` until the thread's run takes it, then under `mastra-queue:taken:<threadId>`, and becomes a normal message of the thread when that run saves it. Message reads by thread or resource, `updateMessages`, `deleteMessages` and thread cloning never act on a queued signal. Thread IDs that start with `mastra-queue:` are rejected. Processes share the stored signals when the store opens a file or a remote database. In-memory databases, embedded replicas and a local client passed as `client` keep them to one process.

```ts
const storage = new LibSQLStore({ id: 'my-store', url: 'file:./mastra.db' });
const memory = await storage.getStore('memory');
memory?.supportsPendingSignals; // true
memory?.pendingSignalsSharedAcrossProcesses; // true for a file or a remote database
```

`init()` adds one nullable column, `signalRunId`, to `mastra_threads`. Existing messages and threads are unchanged. Message reads and saves don't use it, so a store created with `disableInit: true` keeps serving them before the migration; it needs `init()` (or your own migration) before it sends or claims pending signals.

Requires `@mastra/core` 1.87.0 or later.
