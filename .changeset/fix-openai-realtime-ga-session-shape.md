---
'@mastra/voice-openai-realtime': patch
---

Fix `OpenAIRealtimeVoice.connect()` against the GA Realtime API. The legacy
`OpenAI-Beta: realtime=v1` header is no longer sent (the GA endpoint rejects
it), and the initial `session.update` payload now uses the GA shape: voice
moves to `audio.output.voice`, input transcription moves to
`audio.input.transcription`, and the session is tagged with `type: "realtime"`.

Previously, `connect()` failed with `Unknown parameter: 'session.voice'` /
`Unknown parameter: 'session.input_audio_transcription'` against the current
GA endpoint, so the realtime voice could not start a session.
