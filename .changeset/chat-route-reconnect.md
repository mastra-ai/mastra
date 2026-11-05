---
'@mastra/ai-sdk': minor
'@mastra/core': minor
---

Added reconnectable AI SDK chat routes. Enable `chatRoute({ reconnect: true })` to register a companion `GET <path>/runs/:runId` endpoint that replays and follows a client-owned run through `agent.observe(runId)`.

Reconnects preserve AI SDK v5, v6, and v7 UI message streams, Editor agent version selection, SSE heartbeats, and resource/thread ownership checks. Unknown, expired, or finished runs return 204.
