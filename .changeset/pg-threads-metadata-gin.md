---
'@mastra/pg': patch
---

Listing and counting threads filtered by metadata is now much faster on large thread tables, because `mastra_threads.metadata` gets an index by default. Existing databases build it on startup without blocking writes.
