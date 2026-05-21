---
'@mastra/voice-openai-realtime': patch
---

Fix `OpenAIRealtimeVoice.connect()` against the General Availability Realtime API. Previously, `connect()` failed against `wss://api.openai.com/v1/realtime` with errors like `Unknown parameter: 'session.voice'`, because the WebSocket handshake and initial session update were still using the legacy beta shape.

`voice.connect()` now succeeds against the GA endpoint with no code changes required.
