---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
---

Added `GET /agents/:agentId/runs` for listing an agent’s current running and suspended runs. Run-listing routes require the `agents:read` permission. When server auth is configured, `GET /agents/:agentId/runs` and `GET /agents/:agentId/suspended-runs` now omit suspended tool-call `args` and `suspendPayload` unless the request is scoped by a server-derived `resourceId` or an authorized `threadId`, so agent-wide listings no longer expose tool data across resources.

```http
GET /agents/my-agent/runs?status=suspended
```
