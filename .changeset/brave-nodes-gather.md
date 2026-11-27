---
'@mastra/core': minor
'@mastra/pg': patch
'@mastra/libsql': patch
---

Importer flushes now read an item's link targets in batches instead of one storage call per link: one read before the target pages are rendered, and one after to check that another importer has not taken a target over meanwhile. Pages with many links cost fewer database round trips. PostgreSQL and LibSQL read the nodes with one query.

Knowledge importer storage gets a new optional `getNodes(bindingId, sourceIds)` method. Adapters that leave it out keep compiling and working: the importer then reads one `getNode` per link, as before.

```ts
class MyImportersStorage extends KnowledgeImportersStorage {
  // ...existing methods, getNode included...

  // Optional: return the binding's nodes for these source IDs in one round trip.
  async getNodes(bindingId: string, sourceIds: string[]) {
    return db.importerNodes.findMany({ where: { bindingId, sourceId: { in: sourceIds } } });
  }
}
```
