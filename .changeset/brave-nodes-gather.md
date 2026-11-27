---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Importer flushes now read an item's link targets in batches instead of one storage call per link: one read before the target pages are rendered, and one after to check that another importer has not taken a target over meanwhile. Pages with many links cost fewer database round trips.

Knowledge importer storage gets a new `getNodes(bindingId, sourceIds)` method. The base class implements it with one `getNode` per id, and the importer falls back to that loop on adapters that do not define it. PostgreSQL and LibSQL read the nodes with one query.
