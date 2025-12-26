---
'@mastra/otel-exporter': minor
'@mastra/express': minor
'@mastra/playground-ui': minor
'@mastra/client-js': minor
'@mastra/observability': minor
'@mastra/hono': minor
'@mastra/cloudflare-d1': minor
'@mastra/react': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
'@mastra/inngest': minor
'@mastra/server': minor
'@mastra/dynamodb': minor
'@mastra/mongodb': minor
'@mastra/upstash': minor
'@mastra/core': minor
'@mastra/convex': minor
'@mastra/libsql': minor
'@mastra/lance': minor
'@mastra/mssql': minor
'@mastra/pg': minor
---

Unified observability schema with entity-based span identification

## What changed

Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

**Before:**
```typescript
// Old span structure
span.agentId   // 'my-agent'
span.toolId    // undefined
span.workflowId // undefined
```

**After:**
```typescript
// New span structure
span.entityType // EntityType.AGENT
span.entityId   // 'my-agent'
span.entityName // 'My Agent'
```

## New `listTraces()` API

Query traces with filtering, pagination, and sorting:

```typescript
const { spans, pagination } = await storage.listTraces({
  filters: {
    entityType: EntityType.AGENT,
    entityId: 'my-agent',
    userId: 'user-123',
    environment: 'production',
    status: TraceStatus.SUCCESS,
    startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
  },
  pagination: { page: 0, perPage: 50 },
  orderBy: { field: 'startedAt', direction: 'DESC' },
});
```

**Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

## New retrieval methods

- `getSpan({ traceId, spanId })` - Get a single span
- `getRootSpan({ traceId })` - Get the root span of a trace
- `getTrace({ traceId })` - Get all spans for a trace

## Backward compatibility

The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

## Migration

**Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

**No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.
