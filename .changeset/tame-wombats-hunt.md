---
'@mastra/core': minor
---

Added `runId`, `sessionId`, `userId`, and `organizationId` filters to advanced trace queries. Use them at trace scope or inside `spans.some` / `spans.none` with `eq`, `ne`, `in`, `notIn`, `exists`, and `notExists`. Value discovery does not suggest these values, and `organizationId` can only narrow the trusted tenant scope.

```ts
const result = await observability.queryTraces(
  planTraceQuery(
    parseTraceQueryRequest({
      timeRange,
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'userId' }, right: { literal: 'user-42' } },
          { op: 'eq', left: { path: 'sessionId' }, right: { literal: 'session-9' } },
        ],
      },
    }),
  ),
);
```
