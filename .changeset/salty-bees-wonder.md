---
'@mastra/playground': minor
'@mastra/playground-ui': minor
---

Added trace-level Agent Learning theme drill-in with theme details, examples, history, per-signal Noise summaries, and drag-and-drop signal column reordering.

Added optional Sankey node activation with mouse and keyboard support, including per-node eligibility.

```tsx
<SankeyChart
  onNodeClick={({ column, value }) => openDrilldown(column.id, value)}
  isNodeClickable={({ value }) => drillableNodeIds.has(value)}
/>
```
