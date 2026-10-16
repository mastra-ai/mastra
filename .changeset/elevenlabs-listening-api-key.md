---
'@mastra/voice-elevenlabs': patch
---

Fixed `ElevenLabsVoice.listen()` to use `listeningModel.apiKey` (falling back to `ELEVENLABS_API_KEY`) instead of the speech key. A voice configured with only a listening key no longer throws on construction, and `getListener()` now reports `enabled: false` when no listening key is available.

If you previously relied on `speechModel.apiKey` for transcription without setting `ELEVENLABS_API_KEY`, `listen()` now throws. Pass the key to the listening model as well:

```ts
// Before
const voice = new ElevenLabsVoice({ speechModel: { apiKey: 'sk-...' } });

// After
const voice = new ElevenLabsVoice({
  speechModel: { apiKey: 'sk-...' },
  listeningModel: { apiKey: 'sk-...' },
});
```
