---
'@mastra/playground-ui': minor
---

Improved the Knowledge explorer. The graph now fills the explorer, with the page tree and the selected page's details in panels that slide in over its edges instead of squeezing it. Graph and Page switch with tabs, the graph's controls use the shared button group, and fits, the legend and the zoom controls stay clear of both panels. Narrow screens keep the stacked layout.

`KnowledgePageExplorer` also takes two optional props. `toolbarEnd` adds your own actions to the end of the toolbar, and `flush` drops the graph's border when the page around it already frames it.

```tsx
<KnowledgePageExplorer
  graph={graph}
  source={source}
  selectedPageId={selectedPageId}
  onSelect={setSelectedPageId}
  view={view}
  onViewChange={setView}
  toolbarEnd={<Button>Importers</Button>}
  flush
/>
```
