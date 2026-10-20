---
'@mastra/voice-google-gemini-live': patch
---

Added `inputAudioTranscription` and `outputAudioTranscription` options to `GeminiLiveVoice` so you can pass BCP-47 language hints to Gemini Live transcription. Without hints, the server auto-detects the language and can transcribe short or accented speech in the wrong language.

```ts
const voice = new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY,
  inputAudioTranscription: { languageCodes: ['es-ES'] },
});
```

Leaving the options out keeps the current behavior.
