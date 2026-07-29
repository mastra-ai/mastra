---
'@mastra/client-js': patch
---

Added `TraceInsightResponse` for typed entity-learning trace summaries.

```ts
import type { TraceInsightResponse } from '@mastra/client-js';

const traceId = (insight: TraceInsightResponse) => insight.traceId;
```
