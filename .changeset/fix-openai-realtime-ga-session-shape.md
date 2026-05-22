---
'@mastra/voice-openai-realtime': patch
---

Fix `OpenAIRealtimeVoice` against the General Availability Realtime API. Previously, `connect()` failed against `wss://api.openai.com/v1/realtime` with errors like `Unknown parameter: 'session.voice'`, because the WebSocket handshake and initial session update were still using the legacy beta shape. Text-only responses also stopped emitting `writing` events because the GA endpoint renamed `response.text.*` to `response.output_text.*`.

`voice.connect()` now succeeds against the GA endpoint and text-only responses fire `writing` events on both legacy beta and GA endpoints, with no code changes required.
