---
'mastra': patch
---

Fix browser-stream WebSocket connecting for agents without browser tools. The studio playground previously opened a `/browser/:agentId/stream` WebSocket on every agent chat, regardless of whether the agent had a browser toolset configured. For agents without browser tools, the failed connection triggered up to 5 exponential-backoff reconnect attempts, with each status flip rerendering all `useBrowserSession` consumers and causing visible UI thrash (sidebars/panels collapsing).

The provider now accepts an `enabled` prop that is wired from the agent's `browserTools` field at all mount sites, so the WebSocket is only opened for agents that actually use browser tools.
