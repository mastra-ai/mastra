---
'@mastra/react': minor
'@mastra/playground-ui': patch
---

Added live updates for trace lists. When the observability store supports delta polling, `useTraceQueryLatest` polls for new and updated traces and merges them into the list loaded by `useTraceQuery`, so already loaded pages are not fetched again.

Pass the same `query` and `limit` to both hooks, and use `useTraceQueryDeltaPollingAvailable` to check whether the server supports it:

```tsx
import { useTraceQuery, useTraceQueryLatest, useTraceQueryDeltaPollingAvailable } from '@mastra/react';

const { enabled: deltaPolling } = useTraceQueryDeltaPollingAvailable();
const list = useTraceQuery({ query, limit });
useTraceQueryLatest({ query, limit, enabled: deltaPolling, refetchInterval: 10_000 });
```

`mergeTraceQueryDelta` is also exported if you manage the list cache yourself.
