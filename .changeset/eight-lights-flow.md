---
'@mastra/inngest': patch
---

Fixed `POST /api/agents/:agentId/recover` returning a 500 for agents created with `createInngestAgent()`. The error told users to set `durable: true`, which does not apply to Inngest agents. Inngest already retries and replays these runs, so recovering one now returns a clear 400 "not supported" error that points to `observe(runId)` for reconnecting to a running stream. With `recovery.durableAgents: 'auto'`, startup recovery now skips Inngest agents instead of logging an error for each one. Fixes #25160.
