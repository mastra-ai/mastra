---
'@mastra/pg': patch
---

Fixed a PostgreSQL transaction resolving as if its writes were saved when a statement in it had failed and the caller swallowed that failure through an explicit `drain()`. PostgreSQL answers COMMIT on such a transaction with a rollback; `tx()` now rejects with `TransactionRolledBackError`. A failed savepoint is also released after it is rolled back, so refused writes no longer leave savepoints open until the transaction ends.
