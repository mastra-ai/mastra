---
'@mastra/playground-ui': minor
---

Added `canCreate` to `SavedViewsProvider` so hosts can hide view creation for users who may only read saved views. When `false`, the observability saved views picker hides "Save as new view" and "Duplicate"; views can still be applied. Combine it with `canEdit` for a picker that only applies views.

```tsx
<SavedViewsProvider source={source} canCreate={false} canEdit={() => false}>
  {children}
</SavedViewsProvider>
```
