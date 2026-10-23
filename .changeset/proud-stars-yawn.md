---
'@mastra/react': minor
---

Added `useQueryThreads` and `useThreadQueryAvailable` hooks to list thread rows from the thread query API, with filters, sorting and infinite scroll.

```tsx
import { useThreadQueryAvailable } from '@mastra/react/hooks/capabilities';
import { useQueryThreads } from '@mastra/react/hooks/traces';

const { enabled } = useThreadQueryAvailable();
const { threads, setEndOfListElement } = useQueryThreads({
  query: {
    timeRange: { traces: { from, to } },
    orderBy: [{ field: 'startedAt', direction: 'desc' }],
  },
  enabled,
});
```
