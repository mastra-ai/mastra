---
'@mastra/react': patch
---

Fixed memory message refreshes after an agent run. All loaded pages for the current agent's thread now refresh, and other agents' messages are left alone.

Added `memoryThreadMessagesQueryKeyPrefix` to target every page of a thread's messages for one agent:

```ts
import { memoryThreadMessagesQueryKeyPrefix } from '@mastra/react/hooks/memory';

await queryClient.refetchQueries({
  queryKey: memoryThreadMessagesQueryKeyPrefix(threadId, agentId),
});
```

`memoryThreadMessagesQueryKey` now places `agentId` before `page`. If you build these query keys by hand, use the helpers instead.
