---
'@mastra/server': patch
---

Fix 'Memory is not initialized' error in studio/playground for agents without memory

When using agents with sub-agents but no memory configured, the playground UI would log numerous HTTPException errors because the WorkingMemoryProvider always mounts and calls memory endpoints.

Changed GET /api/memory/config and GET /api/memory/threads/:threadId/working-memory to return null responses instead of throwing 400 errors when memory is not configured, matching how GET /api/memory/status already handles this gracefully.
