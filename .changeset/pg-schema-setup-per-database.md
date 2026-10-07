---
'@mastra/pg': patch
---

Fixed `PostgresStore.init()` failing with `schema "<name>" does not exist` when a process connects to more than one database using the same `schemaName`. Each database now creates its own schema during initialization.
