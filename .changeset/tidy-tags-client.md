---
'@mastra/client-js': minor
---

Added the `includes` and `notIncludes` trace-query operators and the `array` value kind to the generated trace-query types.

**Example**

```ts
const result = await mastraClient.queryTraces({
  timeRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-21T00:00:00.000Z' },
  where: { op: 'includes', path: 'tags', value: 'manual-review' },
});
```
