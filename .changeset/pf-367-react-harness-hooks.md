---
'@mastra/react': minor
---

Add React Harness hooks for building reconnectable session UIs that stay in sync with remote Harness state.

```tsx
import { useHarnessSession } from '@mastra/react';

function HarnessPanel() {
  const { snapshot, pendingInbox, durableWork, isLoading, error } = useHarnessSession({
    harnessName: 'default',
    sessionId: 'session-1',
  });

  if (isLoading) return <span>Loading session...</span>;
  if (error) return <span>{error.message}</span>;

  return (
    <SessionView
      snapshot={snapshot}
      pendingInbox={pendingInbox}
      durableWork={durableWork}
    />
  );
}
```
