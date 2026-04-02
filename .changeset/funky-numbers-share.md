---
'@mastra/server': patch
---

Fixed memory endpoints (list threads, get thread, list messages, delete messages, memory status) returning 404 when agentId refers to a stored agent not resolvable via getAgentById(). Endpoints now fall back to storage-based access, matching the behavior when agentId is omitted. Fixes #14765.
