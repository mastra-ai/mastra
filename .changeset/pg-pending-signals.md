---
'@mastra/pg': minor
---

Added pending agent signals to `PostgresStore`. Its memory store now sets `supportsPendingSignals`: a signal sent to a thread is kept in the messages table under the reserved thread ID `mastra-pending-signals:<threadId>` until a run claims it, and every process that shares the database sees the same rows. Message reads, `updateMessages` and thread cloning never return these rows while they are pending; the row becomes a message of its thread when a run claims it, unless the signal is transient. Thread IDs that start with `mastra-pending-signals:` are rejected.

```ts
const storage = new PostgresStore({ id: 'my-store', connectionString: process.env.DATABASE_URL });
const memory = await storage.getStore('memory');
memory?.supportsPendingSignals; // true
```

**Schema changes:** `init()` adds two nullable columns, `signalClaimedBy` and `signalState`, to the messages table and one nullable column, `signalRunId`, to the threads table, on new and existing databases. It also creates a partial index on the messages table for rows that carry a claimant, unless `skipDefaultIndexes` is set. `exportSchemas()` includes the columns and the index. Message reads don't use these columns; message saves write `signalState`. `init()` does nothing on a store created with `disableInit` or while the environment variable `MASTRA_DISABLE_STORAGE_INIT` is `true`: before this version saves messages or sends or claims pending signals, run `init()` once on a store created without `disableInit` and without that variable set to `true`, or apply the same columns and index with your own migration.

**Transactions of existing methods:** `saveMessages`, `updateMessages`, `deleteMessages`, `deleteThread` and `updateThreadResourceId` now:

- run at READ COMMITTED, whatever `default_transaction_isolation` is set to;
- lock the thread rows they touch for the whole transaction, so concurrent writes to one thread run one after another (`updateThreadResourceId` already did);
- send one extra statement per call to take that lock (except `updateThreadResourceId`).

This also fixes a deadlock between `updateThreadResourceId` and a `saveMessages` that re-saves a message of the same thread or moves it to another thread. Retention pruning takes no thread lock: it can still deadlock with the end of a run that holds signals on the rows it deletes, and Postgres then cancels one of the two.

Requires `@mastra/core` 1.87.0 or later.
