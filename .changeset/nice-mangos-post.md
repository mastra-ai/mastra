---
'@mastra/playground-ui': minor
---

Added `useTraceQuery` to build trace lists that load more results as users scroll, without managing pagination cursors or duplicate traces manually.

Render the component inside your existing `MastraReactProvider` and React Query `QueryClientProvider`. Supply a time range and attach `setEndOfListElement` after the trace rows to enable automatic pagination:

```tsx
import { useTraceQuery } from '@mastra/playground-ui/domains/traces';

export function TraceList() {
  const { data, setEndOfListElement } = useTraceQuery({
    query: {
      timeRange: {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-08T00:00:00.000Z',
      },
    },
  });

  return (
    <div>
      {data?.map(trace => (
        <div key={trace.traceId}>{trace.name}</div>
      ))}
      <div ref={setEndOfListElement} />
    </div>
  );
}
```
