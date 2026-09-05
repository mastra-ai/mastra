---
'@mastra/pg': minor
---

Added read/write pool separation to `PostgresStore`. Pass `writePool` together with an optional `readPool` to route plain reads to a replica while writes, DDL, transactions, and locking reads stay on the primary. When `readPool` is omitted, reads fall back to the writer, and the existing single `pool` configuration keeps working unchanged. Closes #12035.
