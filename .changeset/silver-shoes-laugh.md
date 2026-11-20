---
'@mastra/react': patch
---

Fixed memory-message refreshes to update every page for the current agent without refetching other agents. Added `memoryThreadMessagesQueryKeyPrefix` and changed the exported `memoryThreadMessagesQueryKey` to place `agentId` before `page`.

```ts
queryClient.refetchQueries({ queryKey: memoryThreadMessagesQueryKeyPrefix(threadId, agentId) });
```

This matches all cached pages for that thread and agent, but not pages for other agents.

If you build this query key by hand, switch to the helpers:

```ts
// Before
queryClient.setQueryData(['memory', 'thread', threadId, 'messages', page, agentId], data);

// After
queryClient.setQueryData(memoryThreadMessagesQueryKey(threadId, page, agentId), data);
```
