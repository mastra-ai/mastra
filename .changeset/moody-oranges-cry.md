---
'@mastra/core': minor
---

Deprecated the `group` option on the trace-query request contract. Grouping remains functional until the next major release; use the `queryThreads` thread-query contract for new code (exposed as `queryTraceThreads()` in `@mastra/client-js`).

**Before:**

```ts
import type { TraceQueryRequest } from '@mastra/core/storage';

const request: TraceQueryRequest = { timeRange, group: { by: ['threadId'] } };
```

**After:**

```ts
import type { QueryThreadsInput } from '@mastra/core/storage';

const input: QueryThreadsInput = { traces: { timeRange } };
```
