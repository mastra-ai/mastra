---
'@mastra/client-js': patch
---

Added the `TraceInsightResponse` type for entity-learning trace summaries.

```ts
import type { TraceInsightResponse } from '@mastra/client-js';

const renderInsight = (insight: TraceInsightResponse) => insight.summary?.summary ?? insight.traceId;
```
