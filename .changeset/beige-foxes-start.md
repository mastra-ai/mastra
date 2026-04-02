---
'@mastra/server': minor
---

Add browser streaming endpoints and WebSocket handlers

- New `/api/agents/:agentId/browser/stream` WebSocket endpoint for screencast streaming
- New `/api/agents/:agentId/browser/close` endpoint for closing browser sessions
- Input handler for mouse and keyboard event injection
- Viewer registry for managing screencast connections per agent/thread
