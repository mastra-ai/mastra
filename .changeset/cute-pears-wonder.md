---
'@mastra/react': minor
---

Added `useQuerySpans` and `useSpanQueryAvailable` hooks for listing individual spans from observability stores that support span queries. `useQuerySpans` loads spans with cursor-based infinite scroll: attach `setEndOfListElement` to the last row and the next page loads when it scrolls into view. You can also call `fetchNextPage` yourself, and `hasNextPage` tells you whether more spans remain.

```tsx
import { useSpanQueryAvailable } from '@mastra/react/hooks/capabilities';
import { useQuerySpans } from '@mastra/react/hooks/traces';

const { enabled } = useSpanQueryAvailable();
const { spans, hasNextPage, isFetchingNextPage, setEndOfListElement } = useQuerySpans({
  query: { timeRange: { from, to }, orderBy: [{ field: 'startedAt', direction: 'desc' }] },
  enabled,
});
```
