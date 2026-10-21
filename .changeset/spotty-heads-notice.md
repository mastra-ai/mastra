---
'@mastra/react': minor
---

Added live updates for trace lists. When the observability store supports delta polling, `useTraceQueryLatest` polls for new and updated traces and merges them into the list loaded by `useTraceQuery`, so already loaded pages are not fetched again.

Pass the same `query` and `limit` to both hooks, and use `useTraceQueryDeltaPollingAvailable` to check whether the server supports it:

```tsx
import { useTraceQueryDeltaPollingAvailable } from '@mastra/react/hooks/capabilities';
import { useTraceQuery, useTraceQueryLatest } from '@mastra/react/hooks/traces';

const { enabled: deltaPolling } = useTraceQueryDeltaPollingAvailable();
const list = useTraceQuery({ query, limit });
useTraceQueryLatest({ query, limit, enabled: deltaPolling, refetchInterval: 30_000 });
```

`mergeTraceQueryDelta` is also exported from `@mastra/react/hooks/traces` if you manage the list cache yourself.
