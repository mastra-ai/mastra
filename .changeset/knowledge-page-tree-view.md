---
'@mastra/playground-ui': patch
---

Added `KnowledgePageExplorer`, a Knowledge browser that Studio and Factory share: search, a page tree, a graph of scopes and pages, and a page view, all on one selection.

- **Graph:** shows parent → child links, mentions between pages, pinned pages and, when the host passes `grants`, which scopes can reach which (role named on hover). The first click selects a page; a second click opens it. A click on empty canvas clears the selection, and dragging the canvas doesn't. Pages already on screen stay put when data refreshes.
- **Page view:** the body as markdown (raw HTML is escaped), notes with links for resolved `[[mentions]]`, child pages, the notes that mention the page, and recent activity.
- **Tree:** clicking a scope narrows the tree and graph to it; a page selected elsewhere opens its path.

The host owns the selection and view state and reads through its own routes:

```tsx
import { KnowledgePageExplorer } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';

<KnowledgePageExplorer
  graph={graph} // { pages, edges, pinnedIds, grants? }
  source={{ usePage, useSearch, useTreeLevels, useActivity }}
  selectedPageId={pageId}
  onSelect={id => setPageId(id)} // null when the selection is cleared
  view={view}
  onViewChange={setView}
/>;
```

`KnowledgePageTree`, `KnowledgePageDetail` and `KnowledgePageGraph` are exported for hosts that lay these out themselves.
