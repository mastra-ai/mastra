---
'@mastra/client-js': minor
'@mastra/playground-ui': minor
---

Added rolling-compatible Trace Intelligence entity index metadata types and an index-first list and compact view with controlled search, sorting, and view state.

```tsx
<TraceIntelligenceEntityIndex
  search={search}
  sort={sort}
  view={view}
  getEntityHref={entity => `/intelligence/entities/${entity.entityType}/${entity.entityId}`}
/>
```
