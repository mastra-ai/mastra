---
'@mastra/playground-ui': minor
---

Added a `fill` prop to `BrandLoader`, and `fill="screen"` to it and to `Spinner`, so a page or panel loader is always centered. Without a set height on the parent, a filled loader now takes a minimum one. `LoaderFill` does the same for a loader with text beside it.

```tsx
// Before
<div className="flex h-full items-center justify-center">
  <BrandLoader />
</div>

// After
<BrandLoader fill />
```

Directly inside `PageLayout`, a filled loader centers on the whole page, where the route's loader sits, so one follows the other without a jump. `Spinner fill` now renders `data-slot="loader-fill"` instead of `spinner-fill`.
