---
'@mastra/voice-elevenlabs': patch
---

`ElevenLabsVoice.listen()` now uses `listeningModel.apiKey` (falling back to `ELEVENLABS_API_KEY`) instead of the speech key, and a voice configured with only a listening key no longer throws on construction.
