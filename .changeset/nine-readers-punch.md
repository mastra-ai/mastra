---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Importer flushes and link refreshes now read a page's parents in one storage call instead of one per level, so deep pages cost fewer database round trips. PostgreSQL and LibSQL answer it with one recursive query.

Knowledge storage adapters get a new `getPageParents({ parentId, read })` method. It returns the parent and its ancestors, nearest first, up to the scope page. The base class implements it with one `getPage` per level, so adapters that do not override it keep working unchanged.

```ts
const knowledge = await storage.getStore('knowledge');
// Nearest first: [parent, grandparent, ..., scope page]
const parents = page.parentId ? await knowledge!.getPageParents({ parentId: page.parentId, read: 'all' }) : [];
// The chain stops early at a missing or unreadable page, and keys are optional,
// so a key path exists only when the chain reaches the scope and every page below it has a key.
const below = [...parents.filter(parent => !parent.isScope).reverse(), page];
const keys = below.flatMap(p => (p.key ? [p.key] : []));
// The page's key path below its scope, e.g. ['guides', 'setup', 'install'], or undefined.
const path = parents.at(-1)?.isScope && keys.length === below.length ? keys : undefined;
```
