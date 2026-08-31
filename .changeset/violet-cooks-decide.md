---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
---

Added `GET /agents/:agentId/runs` for listing an agent’s current running and suspended runs. Run-listing routes require the `agents:read` permission.

```http
GET /agents/my-agent/runs?status=suspended
```
