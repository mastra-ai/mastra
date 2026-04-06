---
'@mastra/voice-openai-realtime': patch
---

Fix requestContext propagation to tool executions during OpenAI Realtime voice sessions. Tools now correctly receive the caller's request context passed via `voice.connect({ requestContext })`.
