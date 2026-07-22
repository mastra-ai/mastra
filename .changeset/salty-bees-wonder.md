---
'@mastra/playground-ui': minor
---

Added optional Sankey node activation with mouse and keyboard support, including per-node eligibility.

```tsx
<SankeyChart
  onNodeClick={({ column, value }) => openDrilldown(column.id, value)}
  isNodeClickable={({ value }) => drillableNodeIds.has(value)}
/>
```
