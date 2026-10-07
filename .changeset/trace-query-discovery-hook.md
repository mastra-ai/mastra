---
'@mastra/react': minor
---

Added `useTraceQueryDiscoveryAvailable`, which reports whether the observability store supports trace query field and value discovery. `useTraceMetadataFilterFields` now also returns `canonicalFields`, the store's built-in trace fields with their supported operators.

```tsx
import { useTraceQueryAvailable, useTraceQueryDiscoveryAvailable } from '@mastra/react/hooks/capabilities';
import { useTraceMetadataFilterFields } from '@mastra/react/hooks/traces';

function TraceFields({ timeRange }) {
  const { enabled: withQueryTrace } = useTraceQueryAvailable();
  const { enabled: withDiscovery } = useTraceQueryDiscoveryAvailable();

  // Only call the discovery endpoint when the store supports both.
  const { fields, canonicalFields } = useTraceMetadataFilterFields({
    timeRange,
    queryOptions: { enabled: withQueryTrace && withDiscovery },
  });

  const tags = canonicalFields.find(field => field.path === 'tags');
  // tags?.operators → ['includes', 'notIncludes', 'exists', 'notExists']
}
```
