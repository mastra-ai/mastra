---
'@mastra/server': patch
---

Fixed `GET /agent-controller/:controllerId/sessions/:resourceId/threads` and `GET /agent-controller/:controllerId/sessions/:resourceId/threads/:threadId/messages` provisioning a workspace/sandbox on every request. Both endpoints previously routed through session creation as a side effect, stalling read-only page visits 5–17s and consuming a sandbox slot per visit. They now read from storage directly. Session creation and workspace/sandbox provisioning continue to happen on the write path as before.
