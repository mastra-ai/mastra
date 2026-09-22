---
'@mastra/client-js': minor
'@mastra/playground-ui': minor
---

Added typed nested metadata paths and scalar discovery values to the trace query client. Studio now shows nested and literal-dot metadata fields as distinct filters, offers type-specific operators, and preserves strings, numbers, booleans, empty strings, and whitespace through saved filter URLs.

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
