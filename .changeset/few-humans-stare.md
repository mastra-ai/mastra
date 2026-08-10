---
'@mastra/playground-ui': minor
---

Added a `fit` prop to `DataList` to control horizontal sizing. The default `fit="content"` keeps the existing behavior: the grid grows with its widest content and the list scrolls horizontally. The new `fit="container"` makes the list fill its container so flexible columns truncate instead of overflowing — useful for tables that must stay within the viewport. `DataListSkeleton` accepts the same prop.

```tsx
// Before: wide content always forced horizontal scrolling
<DataList columns="auto 1fr auto">…</DataList>

// After: opt in to viewport-fitting behavior
<DataList columns="auto minmax(0, 1fr) auto" fit="container">…</DataList>
```
