---
'@mastra/playground-ui': minor
---

Added optional Sankey node activation with mouse and keyboard support.

```tsx
<SankeyChart onNodeClick={({ column, value }) => openDrilldown(column.id, value)} />
```
