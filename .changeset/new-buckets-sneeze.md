---
'@mastra/client-js': minor
---

Added typed nested metadata paths and scalar discovery values to the trace query client.

```ts
const result = await client.queryTraces({
  timeRange,
  where: { op: 'eq', left: { path: 'metadata.flags.reviewed' }, right: { literal: false } },
})
```

**Breaking change**

Metadata discovery values are now `string | number | boolean` instead of always `string`. Narrow the value before using string-only operations:

```ts
const [{ value }] = await client.getTraceQueryValues(request)
if (typeof value === 'string') console.log(value.toUpperCase())
```
