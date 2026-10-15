---
'@mastra/voice-sarvam': patch
---

Fixed `SarvamVoice.listen()` sending the speech model's API key. `listen()` now uses `options.apiKey`, then the listening model's key, and `speak()` uses the speech model's key, so projects with separate Sarvam keys for speech-to-text and text-to-speech bill each to the right key.

```ts
const voice = new SarvamVoice({
  speechModel: { apiKey: 'tts-key' },
  listeningModel: { apiKey: 'stt-key' },
});
await voice.listen(audio); // uses 'stt-key'
await voice.listen(audio, { apiKey: 'per-call-key' }); // uses 'per-call-key'
```
