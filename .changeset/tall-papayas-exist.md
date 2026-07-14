---
'@mastra/voice-google': minor
---

Added Cloud Speech-to-Text v2 support to `GoogleVoice.listen()`. Pass `{ v2: true }` in options to use the v2 API, which supports additional audio formats like AAC-in-MP4 (iOS Safari) via `autoDecodingConfig` or `explicitDecodingConfig`. The v1 path remains the default — no breaking changes.
