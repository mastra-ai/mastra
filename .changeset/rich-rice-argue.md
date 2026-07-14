---
'@mastra/voice-google': minor
---

Expose full Cloud TTS request surface in `GoogleVoice.speak()`. You can now pass `options.input` (for SSML, markup, custom pronunciations, multi-speaker markup) and `options.voice` (for modelName, multi-speaker voice config) to access the complete `ISynthesizeSpeechRequest` proto. Existing text-only usage is unchanged.
