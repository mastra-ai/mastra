---
'@mastra/playground-ui': minor
---

Reworked the trace details panel so it is easier to scan and sized to the trace you open.

**Header**

- The top row holds trace navigation, the trace ID (first 6 characters, click to copy) and the actions, in this order: Score trace, Add to dataset, Open trace page, Download trace JSON, then Close.
- A second row shows the entity, a status badge and timing, token and cost metadata. While the trace loads, this row shows a skeleton.

**Sizing**

- Agent traces open the drawer at 80% width, or full width with a span open. Other traces open at 50%, or 80% with a span open, because they have no Messages column.
- The side column and span column now keep a fixed pixel width when the drawer changes size. The widths you set by dragging are remembered per entity type. The columns open at those widths while the trace is still loading.

**Removed the auto refresh toggle**

The traces list now always polls for new traces, so the "Auto refresh" checkbox is gone. Remove `TracesExplorer.AutoRefresh` from your layout. `useTracesListSource` no longer returns `setAutoRefetch`, and its `initialAutoRefetch` option is now `autoRefetch`.

```tsx
// Before
<TracesExplorer.AutoRefresh />;
useTracesListSource({ initialAutoRefetch: false });

// After
useTracesListSource({ autoRefetch: false });
```

**Other additions**

- Added `TraceScoresList`, a compact list of a trace's scores.
- Added an `entityType` prop on `TraceSpanPanel` and `TraceDataPanelView` that sizes the columns before the trace loads.
- Added an `ellipsis` prop on `DataPanel.CopyId` to truncate without the trailing "…".
