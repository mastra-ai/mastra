---
'@mastra/playground-ui': patch
---

Fixed the "Add item to dataset" dialog so the Input editor stays visible when Ground truth or Tool mocks contain long content. The editors now keep a fixed height and scroll their content instead of stretching the dialog.

Added `withAddTraceToDataset` and `withAddToolMocksToItem` props on `TracesExplorer.Panel` so hosts can hide "Add full trace to dataset" and "Add tool mocks to item" from the trace actions menu. Both default to `true`, so existing setups keep both actions.

```tsx
<TracesExplorer.Panel withAddTraceToDataset={false} withAddToolMocksToItem={false} />
```
