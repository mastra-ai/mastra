---
'@mastra/server': minor
---

Added a route to take ownership of an agent controller thread. The new owner is the authenticated user from the request context, so clients cannot assign ownership to someone else. Requests without an authenticated user id are rejected with 401. The thread must belong to the session's resource (otherwise 404), and when fine-grained authorization is configured the caller needs `memory:write` on the thread.

```http
POST /agent-controller/:controllerId/sessions/:resourceId/threads/:threadId/owner
→ { "ok": true, "ownerId": "user-123" }
```
