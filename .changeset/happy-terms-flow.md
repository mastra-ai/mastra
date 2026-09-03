---
'@mastra/playground-ui': patch
---

Removed DataList visual variants and custom sticky header backgrounds in favor of one bordered table style. The root is now the only element that defines a color: header, sticky columns, separators, rows, `featured` and `error` states no longer set any background, border or ring color (row/header separators and the row focus ring are removed; the skeleton shimmer reuses the root background). `featured`/`error` are exposed as `data-featured` / `data-variant` attributes for consumers that want to style them. Selection checkboxes are now always visible.

**Before**

```tsx
<DataList columns="1fr" variant="striped" stickyHeaderBackground="tinted">
  {rows}
</DataList>
```

**After**

```tsx
<DataList columns="1fr">{rows}</DataList>
```

Added a `variant="light"` option to `DataList` (and `DataListSkeleton`) that removes the panel behind the rows so the list sits directly on the page.
