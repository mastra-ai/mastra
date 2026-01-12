---
'@mastra/server': patch
---

Fix 'Memory is not initialized' error in playground for agents with sub-agents but no memory

When using agents with sub-agents (e.g., agent networks) but no memory configured, the playground UI would log HTTPException errors when fetching messages for sub-agents without memory.

Changed GET /api/memory/threads/:threadId/messages to return empty messages `{ messages: [], uiMessages: [] }` instead of throwing 400 error when memory is not configured for the requested agent.
