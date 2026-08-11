---
'@mastra/playground-ui': minor
---

Removed the `attributes` field and the `TraceAttributes` type from `TracesListViewTrace`.

The traces list used to fall back to `attributes.agentId`/`attributes.workflowId` for the entity column and to `attributes.status` for the status column. Rows now carry `entityName`/`entityId` and a computed `status` directly, and the lightweight rows the list fetches never carried `attributes` at all, so both fallbacks were dead code reading a field nothing produced.

Rows that relied on those fallbacks must set `status` and the entity fields directly:

```tsx
// Before
<TracesListView traces={[{ traceId, name, createdAt, attributes: { status: 'completed' } }]} />

// After
<TracesListView traces={[{ traceId, name, createdAt, status: 'success', entityName: 'weatherAgent' }]} />
```

`TraceAttributes` was reachable as `import type { TraceAttributes } from '@mastra/playground-ui/domains/traces/components/traces-list-view'` and no longer exists. There is no replacement — read `status`, `entityType`, `entityName` and `entityId` off the row instead.
