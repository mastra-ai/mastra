---
'@mastra/voice-openai-realtime': patch
---

Remove the deprecated `OpenAI-Beta: realtime=v1` header from realtime voice connections. OpenAI removed the beta realtime interface, so sending this header broke all realtime voice connections.
