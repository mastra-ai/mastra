---
'@mastra/react': minor
'@mastra/playground-ui': patch
---

Added `useTraceQueryRootDurationAvailable`, a hook that reports whether the server can filter traces by root span duration. It returns `enabled: false` when the server does not declare the capability.

```tsx
import { useTraceQueryRootDurationAvailable } from '@mastra/react/hooks/capabilities';

function DurationFilterToggle() {
  const { enabled, isLoading } = useTraceQueryRootDurationAvailable();
  if (isLoading || !enabled) return null;
  return <button>Filter by duration</button>;
}
```
