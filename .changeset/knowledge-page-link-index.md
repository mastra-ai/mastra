---
'@mastra/core': patch
---

Knowledge now keeps an index of the `[[links]]` in page bodies, so a host can count and list which pages link where without loading every page. `countPageLinks` and `listPageLinks` on the Knowledge store return in and out links for a set of pages, gated by the reader's scopes like every other read. Note `[[mentions]]` show up there as `note` links.

Links resolve when a page is written: by page id, `scope#key/key` path, scope address or page name (the page's own scope first, then the whole store). A link to a page that doesn't exist yet resolves once that page is created, follows renames and moves, and goes back to unresolved when its target is deleted or merged away.

Pages written before this release, or straight to the store, aren't indexed until they are written again. Run `knowledge.reindexLinks()` once to index them all; it needs no vector store.

```ts
await knowledge.reindexLinks();
const store = await mastra.getStorage()!.getStore('knowledge');
const counts = await store!.countPageLinks({ pageIds: [page.id], read: 'all' });
// { [page.id]: { in: 3, out: 1 } }
```
