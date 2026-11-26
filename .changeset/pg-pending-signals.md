---
'@mastra/pg': minor
---

Added pending agent signals to `PostgresStore`. Its memory store now sets `supportsPendingSignals`: a signal sent to a thread is kept as a hidden row of the messages table until a run claims it, and every process that shares the database sees the same rows. Message reads, `updateMessages` and thread cloning skip these rows until the run's messages are saved.

```ts
const storage = new PostgresStore({ id: 'my-store', connectionString: process.env.DATABASE_URL });
const memory = await storage.getStore('memory');
memory?.supportsPendingSignals; // true
```

**Schema changes:** `init()` adds two nullable columns, `signalStatus` and `signalClaimedBy`, to the messages table and one nullable column, `signalRunId`, to the threads table, on new and existing databases. It also creates a partial index on the messages table for rows that carry a signal status or a claimant, unless `skipDefaultIndexes` is set. `exportSchemas()` includes the columns and the index. `init()` does nothing on a store created with `disableInit` or while the environment variable `MASTRA_DISABLE_STORAGE_INIT` is `true`: before this version serves reads, run `init()` once on a store created without `disableInit` and without that variable set to `true`, or apply the same columns and index with your own migration.

**Transactions of existing methods:** `saveMessages`, `updateMessages`, `deleteMessages`, `deleteThread` and `updateThreadResourceId` now:

- run at READ COMMITTED, whatever `default_transaction_isolation` is set to;
- lock the thread rows they touch for the whole transaction, so concurrent writes to one thread run one after another (`updateThreadResourceId` already did);
- send one extra statement per call to take that lock (except `updateThreadResourceId`).

This also fixes a deadlock between `updateThreadResourceId` and a `saveMessages` that re-saves a message of the same thread or moves it to another thread. Retention pruning takes no thread lock: it can still deadlock with the end of a run that holds signals on the rows it deletes, and Postgres then cancels one of the two.
