---
'@mastra/core': minor
---

Added an opt-in structured trace-query Core contract for exact nested metadata paths and typed metadata values. Storage providers can independently advertise structured trace execution, thread execution, and discovery support.

```ts
const request = parseStructuredTraceQueryRequest({
  timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' },
  where: {
    op: 'eq',
    left: { path: ['metadata', 'customer.plan'] },
    right: { literal: 'pro' },
  },
})

const plan = planStructuredTraceQuery(request)
```

Existing trace-query request, discovery, trusted-plan, storage-method, and feature contracts are unchanged.
