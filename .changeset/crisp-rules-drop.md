---
'@mastra/server': patch
---

Fixed idle proxy disconnects on agent SSE routes with transport-only keepalive comments. Configure server.agentSseHeartbeatMs to change the default 25-second interval or set it to 0 to disable comments.
