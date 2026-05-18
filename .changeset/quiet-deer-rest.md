---
'@mastra/deployer': patch
---

When browser streaming is unavailable (the `ws` and `@hono/node-ws` packages aren't installed, or the deployer is running in a serverless environment), the deployer now registers a fallback `GET /api/agents/:agentId/browser/session` route that returns `{ hasSession: false, screencastAvailable: false }`. This lets clients detect that screencast won't work and skip the WebSocket upgrade instead of triggering a noisy reconnect loop.
