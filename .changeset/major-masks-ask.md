---
'@mastra/react': minor
---

Added hooks for listing conversations from observability data. `useTraceThreadsQuery` lists the threads whose traces match a selection, loading more as you scroll. `useTraceThreadSummary` builds one thread's row: first and last message, turn count, and time range. `useThreadQueryAvailable` reports whether the observability store supports thread queries.

```tsx
import { useThreadQueryAvailable } from '@mastra/react/hooks/capabilities';
import { useTraceThreadsQuery } from '@mastra/react/hooks/traces';

const { enabled } = useThreadQueryAvailable();
const { threadIds, setEndOfListElement } = useTraceThreadsQuery({
  selection: { timeRange: { from, to } },
  enabled,
});
```
