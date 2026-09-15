---
'@mastra/voice-openai-live': minor
---

Add `@mastra/voice-openai-live`, a new speech-to-speech voice provider for OpenAI's Live API (`gpt-live-1`). `OpenAILiveVoice` opens a full-duplex WebSocket to the Live endpoint (`wss://api.openai.com/v1/live/sessions`), streams input audio, emits assistant audio (`speaker`/`speaking`) and transcript (`writing`) events, dispatches tool/function calls, and forwards backend reasoning/tool delegation config to the session. This is a distinct provider from `@mastra/voice-openai-realtime` — different endpoint, event contract, and delegation model. Resolves #23582.
