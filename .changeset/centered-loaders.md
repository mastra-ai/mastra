---
'@mastra/playground-ui': minor
---

Added a `fill` prop to `BrandLoader`, so every page and panel shows the same loader in the center of its area. It works in a block, flex or grid parent, with or without a set height. `fill="screen"` covers the window, `size="sm"` suits a panel or dialog, and `LoaderFill` does the same for a loader with text beside it.

```tsx
// Before
<div className="flex h-full items-center justify-center">
  <BrandLoader />
</div>

// After
<BrandLoader fill />
```

Directly inside `PageLayout`, a filled loader centers on the whole page, where the route's loader sits, so one follows the other without a jump.

`Spinner fill` is deprecated in favor of `BrandLoader fill`, and renders `data-slot="loader-fill"` instead of `spinner-fill`. `DataPanel.LoadingData` and `DataDetailsPanel.LoadingData` show the Mastra loader in the center of the panel.
