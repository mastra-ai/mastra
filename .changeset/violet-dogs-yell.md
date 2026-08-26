---
'@mastra/libsql': patch
---

Fixed in-memory LibSQL databases (`url: ':memory:'`) losing all tables and data after the first interactive write transaction (for example when updating workflow state, deleting messages, or upserting vectors). Reads then failed with errors like `SQLITE_ERROR: no such table: mastra_threads`. In-memory databases now keep their single connection alive across transactions, so data persists for the life of the process as documented. Fixes https://github.com/mastra-ai/mastra/issues/22328
