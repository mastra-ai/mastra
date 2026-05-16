---
'mastra': patch
---

Fixed studio playground opening a `/browser/:agentId/stream` WebSocket on every agent chat, regardless of whether the agent had browser tools configured. Failed connections (or connections to servers without the `ws` and `@hono/node-ws` packages installed) previously triggered up to 5 exponential-backoff reconnect attempts, with each status flip rerendering all browser-session consumers and causing visible sidebar/panel thrash.

The playground now probes `GET /api/agents/:agentId/browser/session` before connecting and only opens the WebSocket when the server reports an active session or the user has explicitly opened the browser panel. Agents without browser tools never connect at all.
