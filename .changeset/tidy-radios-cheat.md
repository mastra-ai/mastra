---
'@mastra/core': minor
---

Added `outcome` and `stopReason` to advanced span and trace queries. You can now filter, group, and discover values by how a span ended and why, separately from `status`. Span and trace results also return `stopReasonContext`.

At trace scope the fields read the root span. Use `spans.some` to find traces where any span hit a limit:

```ts
const { traces } = await client.queryTraces({
  timeRange,
  where: { spans: { some: { op: 'eq', left: { path: 'outcome' }, right: { literal: 'limit' } } } },
});
```

A missing outcome means "not recorded", never success. Stores opt in through the new `span-query-outcome-fields` and `trace-query-outcome-fields` features.
