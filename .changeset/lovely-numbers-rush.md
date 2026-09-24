---
'@mastra/core': minor
---

Added structured trace-query helpers for filtering exact nested metadata paths and preserving string, number, and boolean values during discovery.

```ts
import { parseStructuredTraceQueryRequest, planStructuredTraceQuery } from '@mastra/core/storage'

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

Existing trace queries and storage integrations continue to use their current requests, discovery results, plans, methods, and feature names.
