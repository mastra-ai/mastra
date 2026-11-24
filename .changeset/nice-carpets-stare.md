---
'@mastra/playground-ui': major
---

**Breaking:** `TraceAsItemDialog` no longer loads the trace. Pass the root span and trajectory as props, loaded with the new `useTraceAsItemData` hook. The trace can now come from a different server than the dataset: the dialog still saves through the Mastra client in context.

**Before**

```tsx
<TraceAsItemDialog traceId={traceId} rootSpanId={rootSpanId} isOpen={isOpen} onClose={onClose} />
```

**After**

```tsx
import { TraceAsItemDialog } from '@mastra/playground-ui/domains/observability/components/trace-as-item-dialog';
import { useTraceAsItemData } from '@mastra/playground-ui/domains/observability/hooks/use-trace-as-item-data';

// Under the client that serves traces
const data = useTraceAsItemData({ traceId, rootSpanId, enabled: isOpen });

// Under the client that serves datasets
<TraceAsItemDialog {...data} traceId={traceId} isOpen={isOpen} onClose={onClose} />;
```
