---
'@mastra/react': minor
---

Added `useTraceTrajectory`, which loads a trace's trajectory (its steps, tool calls and results) through the Mastra client in context.

```tsx
import { useTraceTrajectory } from '@mastra/react/hooks/traces';

const { data: trajectory, isLoading } = useTraceTrajectory({ traceId });
```
