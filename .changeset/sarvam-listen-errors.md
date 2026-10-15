---
'@mastra/voice-sarvam': patch
---

`SarvamVoice.listen()` now throws on Sarvam API errors (e.g. invalid API key, rate limits) instead of silently returning `undefined`. Error messages for both `listen()` and `speak()` now surface Sarvam's `error.message`.
