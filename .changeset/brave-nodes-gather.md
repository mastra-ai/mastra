---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Importer flushes now read all of an item's link targets in one storage call instead of one per link, so pages with many links cost fewer database round trips.

Knowledge importer storage gets a new `getNodes(bindingId, sourceIds)` method. The base class implements it with one `getNode` per id, and the importer falls back to that loop on adapters that do not define it. PostgreSQL and LibSQL read the nodes with one query.
