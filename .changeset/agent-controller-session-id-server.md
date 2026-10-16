---
'@mastra/server': minor
---

**Breaking:** Agent controller session routes are addressed by session id: `/agent-controller/:controllerId/sessions/:sessionId/...`. The `sessionScope` query param is removed.

`POST /agent-controller/:controllerId/sessions` takes `resourceId` plus an optional `sessionId` (and `threadId`). `resourceId` may be omitted when `sessionId` is sent; the session then resumes on the resource it already has. Without a `sessionId` the session id is the `resourceId`, so callers that never passed one reach the same URLs as before. Thread listing returns every thread of the session's resource. When a session is no longer live (for example after a restart), the routes recreate it on the resource of the thread with the session's id, falling back to the session id itself.

```http
# Before
POST /agent-controller/code/sessions        { "resourceId": "repo-1", "sessionScope": "run-a" }
POST /agent-controller/code/sessions/repo-1/messages?sessionScope=run-a

# After
POST /agent-controller/code/sessions        { "resourceId": "repo-1", "sessionId": "run-a" }
POST /agent-controller/code/sessions/run-a/messages
```
