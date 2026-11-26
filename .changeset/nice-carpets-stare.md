---
'@mastra/playground-ui': minor
---

Added `TraceDatasetItemDialog` and `useTraceAsItemData`, so a host can read a trace from one server and save it as a dataset item on another. The dialog takes the trace's root span and trajectory as props and saves through the Mastra client in context. `useTraceAsItemData` loads them through whichever client it runs under.

```tsx
import { TraceDatasetItemDialog } from '@mastra/playground-ui/domains/observability/components/trace-dataset-item-dialog';
import { useTraceAsItemData } from '@mastra/playground-ui/domains/observability/hooks/use-trace-as-item-data';

// Under the client that serves traces
const data = useTraceAsItemData({ traceId, rootSpanId, enabled: isOpen });

// Under the client that serves datasets
<TraceDatasetItemDialog {...data} traceId={traceId} isOpen={isOpen} onClose={onClose} />;
```

**Deprecated:** `TraceAsItemDialog`. It keeps its props and behavior, and reads the trace through the same client it saves with. Use `TraceDatasetItemDialog` with `useTraceAsItemData` instead.
