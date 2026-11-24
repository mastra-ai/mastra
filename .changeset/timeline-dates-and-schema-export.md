---
'@mastra/core': patch
'@mastra/pg': patch
---

Reject impossible calendar dates in Knowledge importer timeline entries instead of silently rolling them into another day. Include timeline tables and indexes in PostgreSQL schema exports so stores provisioned with initialization disabled can write and read entries.
