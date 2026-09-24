---
'@mastra/core': minor
---

Added `runId`, `sessionId`, `userId`, and `organizationId` to advanced trace queries. Use them at trace scope and inside `spans.some` / `spans.none` with `eq`, `ne`, `in`, `notIn`, `exists`, and `notExists`. Field discovery lists them, but value discovery does not return their recorded values because they are private, high-cardinality identifiers.

`organizationId` compares recorded data and is ANDed with the trusted tenant scope, so it can only narrow a tenant's own traces. `projectId` stays rejected in predicates.

```ts
const result = await observability.queryTraces(
  planTraceQuery(
    parseTraceQueryRequest({
      timeRange,
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'organizationId' }, right: { literal: 'org-123' } },
          { op: 'eq', left: { path: 'sessionId' }, right: { literal: 'session-123' } },
          { spans: { some: { op: 'eq', left: { path: 'runId' }, right: { literal: 'run-42' } } } },
        ],
      },
    }),
  ),
);
```

Refs OBS-401
