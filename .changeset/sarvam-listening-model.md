---
'@mastra/voice-sarvam': patch
---

Fixed `SarvamVoice.listen()` ignoring the `listeningModel` passed to the constructor. A voice created with `listeningModel: { model: 'saaras:v3', languageCode: 'hi-IN', mode: 'translit' }` now transcribes with that model, language and mode; before, it always sent `saarika:v2.5` with automatic language detection. Options passed to `listen()` still take precedence.
