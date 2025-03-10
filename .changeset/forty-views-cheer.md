---
'@mastra/core': patch
---

Fixed bug where using an in memory libsql db (config.url = ":memory:) for memory would throw errors about missing tables
