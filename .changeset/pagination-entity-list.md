---
'@mastra/playground-ui': patch
---

Added `EntityList.Pagination` sub-component for server-side pagination of `EntityList` views. Mirrors the existing `ItemList.Pagination` API.

```tsx
<EntityList columns={COLUMNS}>
  <EntityList.Top>...</EntityList.Top>
  {items.map(item => <EntityList.RowLink key={item.id}>...</EntityList.RowLink>)}
  <EntityList.Pagination
    currentPage={page}
    hasMore={hasMore}
    onNextPage={() => setPage(p => p + 1)}
    onPrevPage={() => setPage(p => p - 1)}
  />
</EntityList>
```
