---
'@mastra/client-js': patch
'mastra': patch
---

Added typed support for the new agent controller thread ownership route (`POST /agent-controller/:controllerId/sessions/:resourceId/threads/:threadId/owner`).

```http
POST /agent-controller/code/sessions/resource-1/threads/thread-1/owner
→ { "ok": true, "ownerId": "user-123" }
```
