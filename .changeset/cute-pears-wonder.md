---
'@mastra/react': minor
---

Added `useQuerySpans` and `useSpanQueryAvailable` hooks for listing individual spans from observability stores that support span queries. `useQuerySpans` loads one page per cursor, so you can build Previous/Next pagination.

```tsx
import { useSpanQueryAvailable } from '@mastra/react/hooks/capabilities';
import { useQuerySpans } from '@mastra/react/hooks/traces';

const { enabled } = useSpanQueryAvailable();
const [after, setAfter] = useState<string>();
const { spans, nextCursor } = useQuerySpans({
  query: { timeRange: { from, to }, orderBy: [{ field: 'startedAt', direction: 'desc' }] },
  after,
  enabled,
});
```
