---
'@mastra/inngest': patch
---

Fixed recovery requests for agents created with `createInngestAgent()`. `POST /api/agents/:agentId/recover` now returns a clear 400 "not supported" error that points to `observe(runId)` for reconnecting to a running stream, instead of a 500. With `recovery.durableAgents: 'auto'`, startup recovery skips Inngest agents instead of logging an error for each one. Fixes [#25160](https://github.com/mastra-ai/mastra/issues/25160).
