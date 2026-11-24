---
'@mastra/playground-ui': patch
---

Allowed the Knowledge page tree and selected page to load while the graph is pending. Pass the new optional `graphError` prop to `KnowledgePageExplorer` when the graph fails: the tree stays usable and the canvas shows the error, including when a refresh fails after an earlier graph loaded.

```tsx
<KnowledgePageExplorer
  graph={graph.data}
  graphError={graph.error?.message}
  source={source}
  selectedPageId={selectedPageId}
  onSelect={setSelectedPageId}
  view={view}
  onViewChange={setView}
/>
```
