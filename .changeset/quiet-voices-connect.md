---
'@mastra/voice-openai-realtime': minor
---

Added raw OpenAI Realtime and socket lifecycle events, plus a public `sendEvent` method for custom session control.

Fixed function calls so only tools registered with `addTools` are executed and continued automatically.
