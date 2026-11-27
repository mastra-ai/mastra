---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Importer flushes and link refreshes now read a page's parents in one storage call instead of one per level, so deep pages cost fewer database round trips. PostgreSQL and LibSQL answer it with one recursive query.

Knowledge storage adapters get a new `getPageParents({ parentId, read })` method. It returns the parent and its ancestors, nearest first, up to the scope page. The base class implements it with one `getPage` per level, so adapters that do not override it keep working unchanged.

```ts
const knowledge = await storage.getStore('knowledge');
if (page.parentId) {
  // Nearest first: [parent, grandparent, ..., scope page]. Deleted parents are included, and the
  // list ends early at a parent that is missing or outside `read`.
  const parents = await knowledge!.getPageParents({ parentId: page.parentId, read: 'all' });
  const breadcrumb = parents.reverse().map(parent => parent.name);
}
```
