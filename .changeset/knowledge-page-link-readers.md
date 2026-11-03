---
'@mastra/core': patch
---

Added `readKnowledgePageLinkCounts` and `readKnowledgePageLinks` to `@mastra/core/knowledge`: exact link counts for any set of pages and one page's links with the pages at their other ends, read from the store's link index and filtered by the caller's read scope. Both return `null` when the store has no link index.

```ts
import { readKnowledgePageLinkCounts, readKnowledgePageLinks } from '@mastra/core/knowledge';

const counts = await readKnowledgePageLinkCounts(store, { pageIds: [pageId], read });
if (counts === null) {
  // this store has no link index
}
const links = await readKnowledgePageLinks(store, { pageId, read, direction: 'out' });
```
