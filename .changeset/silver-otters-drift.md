---
'@mastra/hono': patch
---

Added `GET /api/agents/:agentId/browser/session` endpoint that reports whether a screencast WebSocket should be opened for an agent and thread. Returns `{ hasSession, screencastAvailable: true }`. Clients can probe this before upgrading to a WebSocket to avoid idle connections and reconnect storms.
