---
'@mastra/pg': patch
---

Thread lookups filtered by metadata (channel threads, Factory sessions) now use an index instead of scanning every thread. The index is created on startup, concurrently on existing tables.
