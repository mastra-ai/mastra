---
'@mastra/client-js': patch
---

Added `linkCounts(pageIds)` and `pageLinks(pageId, { direction })` to the Knowledge client resource, for the new link count and page link routes.

```ts
const kb = client.getKnowledge('docs');
const { counts } = await kb.linkCounts([pageId]); // { [pageId]: { in: 3, out: 1 } }
const { edges, pages } = await kb.pageLinks(pageId, { direction: 'in' });
```
