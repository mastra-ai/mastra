---
'@mastra/client-js': minor
---

Added reconnect support to `AgentControllerSession.subscribe()` so SSE subscriptions recover after proxy timeouts or transport errors. Fixes #19202.
