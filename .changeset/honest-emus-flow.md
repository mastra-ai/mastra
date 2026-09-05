---
'@mastra/voice-openai-realtime': patch
---

Fixed realtime connections hanging when session creation fails. Connections now reject on handshake errors, early socket closure, or a 15-second timeout configurable with connectTimeoutMs.
