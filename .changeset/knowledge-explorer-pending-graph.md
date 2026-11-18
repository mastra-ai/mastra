---
'@mastra/playground-ui': patch
---

`KnowledgePageExplorer` now accepts `graph={undefined}` while the host is still loading the graph. The toolbar, search, tree panel and selected page work as usual, and a deep-linked page shows its content straight away. Placeholders appear only where the graph's data goes: the graph canvas and, without `useTreeLevels`, the page tree.

```tsx
const graph = useKnowledgeGraph(projectId);

<KnowledgePageExplorer
  graph={graph.data}
  source={source}
  selectedPageId={selectedPageId}
  onSelect={setSelectedPageId}
  view={view}
  onViewChange={setView}
/>;
```
