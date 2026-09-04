---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
---

Added `GET /agents/:agentId/runs` for listing an agent’s current running and suspended runs. Run-listing routes require the `agents:read` permission. When server auth is configured, `GET /agents/:agentId/runs` and `GET /agents/:agentId/suspended-runs` are scoped to the resource that `mapUserToResourceId` mapped the caller to; callers without a mapped resource receive `403` unless they hold an admin permission (`*`, `agents:*`, or `agents:admin`), in which case the `resourceId` query value is honored.

```http
GET /agents/my-agent/runs?status=suspended
```
