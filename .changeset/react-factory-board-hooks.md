---
'@mastra/react': minor
---

Added Factory board hooks under `@mastra/react/hooks/factory`, so any app can render a Factory board from the same data layer Factory's own UI uses.

```tsx
import { FactoryBasePathProvider, useBoardPhasesQuery, useTransitionWorkItemMutation } from '@mastra/react/hooks/factory';

const board = useBoardPhasesQuery(projectId, { board: 'work', sort: 'recent', q: '', filters: {}, windows: {} });
const move = useTransitionWorkItemMutation(projectId, currentUserId);
```

Wrap the tree in `FactoryBasePathProvider` when Factory's routes are served under a different path (for example `/v1/factory`).
