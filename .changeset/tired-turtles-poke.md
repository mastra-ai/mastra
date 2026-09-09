---
'@mastra/libsql': patch
---

Fixed `LibSQLStore` and `LibSQLVector` with `url: ':memory:'` losing every table after the first interactive write transaction (e.g. any workflow step update). Upgraded `@libsql/client` to 0.18.0 and queued store calls behind open transactions so concurrent reads and writes on in-memory databases and embedded replicas no longer fail with `TRANSACTION_ACTIVE`. Fixes #22328.
