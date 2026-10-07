---
'@mastra/core': patch
---

Fixed unbounded memory growth in agents with sub-agents when background tasks are enabled. Repeated tool lookups (for example, frequent `GET /api/agents` health checks) no longer grow the heap until the server runs out of memory.
