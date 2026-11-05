---
'@mastra/ai-sdk': minor
---

Added reconnectable AI SDK chat routes. Enable `chatRoute({ reconnect: true })` to register a companion `GET <path>/runs/:runId` endpoint that replays and follows a client-owned run through `agent.observe(runId)`.

Generate a fresh `runId` for each POST and retain it for reconnects. When using AI SDK's `DefaultChatTransport`, configure `prepareReconnectToStreamRequest` to point to `<path>/runs/<runId>`; its default `<api>/<chatId>/stream` URL does not match this run-based endpoint.

Reconnects preserve AI SDK v5, v6, and v7 UI message streams, Editor agent version selection, SSE heartbeats, and resource/thread/FGA access checks. Disconnecting the POST response does not abort reconnect-enabled runs. Unknown, expired, or finished runs return 204.
