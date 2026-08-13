---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed thread page visits provisioning a workspace/sandbox unnecessarily. The `GET /agent-controller/:controllerId/sessions/:resourceId/threads` and `GET /agent-controller/:controllerId/sessions/:resourceId/threads/:threadId/messages` endpoints now read from storage directly instead of creating a session, eliminating a 5–17s stall on every read-only thread request.
