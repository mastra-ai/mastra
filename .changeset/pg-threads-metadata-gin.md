---
'@mastra/pg': patch
---

Added a GIN index on `mastra_threads.metadata` so listing or counting threads by metadata no longer scans the whole table. Existing databases build it concurrently on startup.
