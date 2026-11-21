---
'@mastra/pg': patch
---

Fixed PostgreSQL transactions reporting success when a statement inside them had failed and the error was caught. PostgreSQL answers COMMIT on such a transaction with a rollback, and `tx()` now rejects with `TransactionRolledBackError` instead of resolving as if the writes were saved.
