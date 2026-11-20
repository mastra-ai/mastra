---
'@mastra/react': patch
---

Fixed memory-message refreshes to update every page for the current agent without refetching other agents. Added `memoryThreadMessagesQueryKeyPrefix` and changed the exported `memoryThreadMessagesQueryKey` to place `agentId` before `page` in the key (the helper's arguments remain `threadId, page, agentId`).

If you constructed a key directly for one page, migrate from `['memory', 'thread', threadId, 'messages', page, agentId]` to `memoryThreadMessagesQueryKey(threadId, page, agentId)`. To refresh all pages for one agent instead:

```ts
queryClient.refetchQueries({ queryKey: memoryThreadMessagesQueryKeyPrefix(threadId, agentId) });
```

This matches all cached pages for that thread and agent, but not pages for other agents.
