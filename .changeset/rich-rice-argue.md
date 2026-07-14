---
'@mastra/voice-google': minor
---

Added support for SSML, custom pronunciations, multi-speaker markup, and Gemini-TTS model selection in `GoogleVoice.speak()`. Existing text-only usage is unchanged.

**New `options.input` fields:** pass `ssml`, `markup`, `customPronunciations`, `multiSpeakerMarkup`, or `prompt` (for Gemini-TTS style steering) directly to the Google Cloud TTS API.

**New `options.voice` fields:** set `modelName` (e.g. `gemini-2.5-flash-preview-tts`) or `multiSpeakerVoiceConfig` alongside the default `name` and `languageCode`.

```ts
// SSML with custom pronunciations
await voice.speak('Give Metacam to the patient.', {
  input: {
    ssml: '<speak>Give <phoneme alphabet="ipa" ph="mɛtəˈkæm">Metacam</phoneme>.</speak>',
  },
});

// Gemini-TTS with prompt-driven styling
await voice.speak('Hello!', {
  voice: { name: 'Kore', modelName: 'gemini-2.5-flash-preview-tts' },
  input: { prompt: 'Warm, calm tone.' },
});
```
