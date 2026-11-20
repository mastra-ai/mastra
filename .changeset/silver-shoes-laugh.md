---
'@mastra/react': patch
---

Fixed memory-message refreshes to update every page for the current agent without refetching other agents. Added memoryThreadMessagesQueryKeyPrefix and changed the exported memoryThreadMessagesQueryKey to place agentId before page.
