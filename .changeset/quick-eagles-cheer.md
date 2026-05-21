---
'@mastra/voice-openai-realtime': patch
---

Stop sending the deprecated `OpenAI-Beta: realtime=v1` request header when connecting to the OpenAI Realtime API. OpenAI removed the beta interface on 2026-05-12, so this header caused the WebSocket connection to be rejected.
