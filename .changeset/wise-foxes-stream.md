---
'mastra': patch
---

Fixed several issues with the studio playground's browser-stream connection:

- Studio used to open a `/browser/:agentId/stream` WebSocket on every agent chat, regardless of whether the agent had browser tools configured. Failed connections (or connections to servers without the `ws` and `@hono/node-ws` packages installed) triggered up to 5 exponential-backoff reconnect attempts, with each status flip rerendering all browser-session consumers and causing visible sidebar/panel thrash. The playground now probes `GET /api/agents/:agentId/browser/session` before connecting and only opens the WebSocket when the server reports an active session or the user has explicitly opened the browser panel. Agents without browser tools never connect at all.

- Screencast frames previously lived in React state on the browser-session provider, so every incoming frame (15–30 fps) re-rendered the provider and its entire subtree — including the sidebar, thread list, agent info, and status pills. Frame data has been moved into an external store consumed via `useSyncExternalStore`, so only the viewer components re-render when a new frame arrives.

- The probe is updated in place when the first browser tool call is observed, so there's no polling and no extra network traffic while idle.
