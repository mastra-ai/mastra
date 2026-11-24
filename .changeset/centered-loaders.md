---
'@mastra/playground-ui': minor
---

Added a `fill` prop to `BrandLoader` that centers it in a page that hasn't shown yet. `fill="screen"` covers the window.

```tsx
// Before
<div className="flex h-full items-center justify-center">
  <BrandLoader />
</div>

// After
<BrandLoader fill />
```

Directly inside `PageLayout` it centers on the whole page, where the route's loader sits, so one follows the other without a jump.
