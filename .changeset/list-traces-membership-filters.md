---
'@mastra/core': patch
'@mastra/duckdb': patch
'@mastra/clickhouse': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `listTraces` so that filters on per-span attributes match traces containing a matching span anywhere in the tree, not only when the root span matches.

Before this fix, filtering by a nested agent, tool, or scorer name returned nothing, even though the Metrics view and discovery endpoints (`getEntityNames`) surfaced those names as valid selections.

```ts
// A trace where "Observer" runs as a nested AGENT under a root WORKFLOW_RUN.

// Before
await store.listTraces({ filters: { entityName: 'Observer' } });
// → [] (because "Observer" is never the root span)

// After
await store.listTraces({ filters: { entityName: 'Observer' } });
// → [{ traceId: '…', rootEntityName: 'workflow-foo', … }]
```

The updated membership filters are: `entityType`, `entityId`, `entityName`, `entityVersionId`, `userId`, `organizationId`, `resourceId`, `runId`, `sessionId`, `threadId`, `requestId`, `environment`, `serviceName`, `experimentId`, and `tags`.

Root-level predicates are unchanged and continue to apply to the root span only: `traceId`, `rootEntityType` / `rootEntityId` / `rootEntityName`, `source`, `startedAt`, `endedAt`, `status`, `hasChildError`, `scope`, and `metadata`.

Each backend resolves membership via a single `EXISTS` subquery against the same spans source, narrowed to the outer query's date window so scans stay bounded. No schema migration is required.
