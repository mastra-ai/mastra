---
'@mastra/hono': patch
---

Added `GET /agents/:agentId/browser/session` endpoint (under the configured `apiPrefix`, default `/api`) that reports whether a screencast WebSocket should be opened for an agent and thread. Clients can probe this before upgrading to a WebSocket to avoid idle connections and reconnect storms.

```bash
curl "http://localhost:4111/api/agents/my-agent/browser/session?threadId=thread-1"
# {"hasSession":true,"screencastAvailable":true}
```

The response shape is `{ hasSession: boolean, screencastAvailable: true }`. `screencastAvailable` is always `true` when this route is registered; the deployer registers a fallback that returns `{ hasSession: false, screencastAvailable: false }` when browser streaming packages aren't installed, so clients can use the same probe in both cases.

`setupBrowserStream` now accepts an optional `apiPrefix` so the probe and existing `POST /agents/:agentId/browser/close` routes are mounted under the same prefix as the rest of the server. The deployer wires this from `mastra.getServer().apiPrefix` automatically.
