---
'@mastra/hono': minor
---

Add browser streaming WebSocket support for Hono server adapter

- New `setupBrowserStream()` function for real-time screencast streaming
- WebSocket route at `/browser/:agentId/stream` for viewer connections
- Browser close endpoint at `/api/agents/:agentId/browser/close`
