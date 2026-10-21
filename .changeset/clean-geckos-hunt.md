---
'@mastra/playground-ui': patch
---

Fixed the "Add item to dataset" dialog so the Input editor stays visible when Ground truth or Tool mocks contain long content. The editors now keep a fixed height and scroll their content instead of stretching the dialog.

Added a `withAddTraceToDataset` prop on `TracesExplorer.Panel` so hosts can hide "Add full trace to dataset" from the trace actions menu. It defaults to `true`.

```tsx
<TracesExplorer.Panel withAddTraceToDataset={false} />
```

Removed the "Add tool mocks to item" action from the trace actions menu, along with the `onAddTraceMocksToItem` prop on `TraceDataPanelView` and `TraceSpanPanel`.
