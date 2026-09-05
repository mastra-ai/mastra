---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
---

Added `GET /agents/:agentId/runs` for listing an agent's current running and suspended runs.

**Access requirements:** Both `/runs` and the existing `/suspended-runs` route require `agents:read`. Authenticated non-admin callers must have a resource mapped by `mapUserToResourceId`; client-supplied resource IDs cannot replace it. Requests missing an authenticated identity are denied when server auth is configured. Admin permissions (`*`, `agents:*`, or `agents:admin`) allow cross-resource listings even for mapped admins.

Thread-level authorization still applies to admins. When fine-grained authorization is configured, inaccessible or missing threads and threadless runs are excluded before pagination and totals. Allowed runs retain full tool arguments and suspend payloads.

**Migration:** Existing suspended-run clients that relied on authentication alone must receive `agents:read` and a server-mapped resource. Use admin permissions only for cross-resource operator access.

```http
GET /agents/my-agent/runs?status=suspended
```
