---
'@mastra/react': patch
---

Fixed chat run correlation by retaining run IDs on streamed messages and exposing the active run ID from useChat. This lets interfaces keep unfinished history separate from current execution.

**Example**

Read `activeRunId` inside a component using `useChat`:

```tsx
import { useChat } from '@mastra/react';

function ChatRunStatus() {
  const { activeRunId } = useChat({ agentId: 'support-agent' });

  return <p>{activeRunId ? `Active run: ${activeRunId}` : 'No active run'}</p>;
}
```
