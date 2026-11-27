---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Importer flushes and link refreshes now read a page's parents in one storage call instead of one per level, so deep pages cost fewer database round trips.

Knowledge storage adapters get a new `getPageParents({ parentId, read })` method. It returns the parent and its ancestors, nearest first, up to the scope page. The base class implements it with one `getPage` per level, so adapters that do not override it keep working unchanged.

```ts
const knowledge = await storage.getStore('knowledge');
const parents = await knowledge!.getPageParents({ parentId: page.parentId!, read: 'all' });
const path = parents.reverse().map(parent => parent.key);
```
