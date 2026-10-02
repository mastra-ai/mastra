---
'@mastra/core': minor
---

Added a storage API for querying individual completed spans with filters, cursors, bounded previews, and model cost.

```typescript
import { planSpanQuery } from '@mastra/core/storage';

const result = await storage.querySpans(
  planSpanQuery({
    timeRange: { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' },
    where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
  }),
);
```
