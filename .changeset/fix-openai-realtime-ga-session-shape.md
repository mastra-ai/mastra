---
'@mastra/voice-openai-realtime': patch
---

Fix `OpenAIRealtimeVoice` against the General Availability Realtime API. Previously, `connect()` failed against `wss://api.openai.com/v1/realtime` with errors like `Unknown parameter: 'session.voice'`, because the WebSocket handshake and initial session update were still using the legacy beta shape. Text-only responses also stopped emitting `writing` events because the GA endpoint renamed `response.text.*` to `response.output_text.*`.

Also fix a separate duplicate-`response.create` issue when the model returned multiple `function_call` outputs in one response. Each call previously emitted its own `response.create` from `handleFunctionCall`'s `finally`, racing the server (which surfaced as `already has an active response in progress`). The send is now consolidated to a single `response.create` after all function calls in the response have been handled.

`voice.connect()` now succeeds against the GA endpoint, text-only responses fire `writing` events on both legacy beta and GA endpoints, and multi-function-call responses no longer race the server — all with no code changes required.
