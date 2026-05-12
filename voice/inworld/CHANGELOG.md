# @mastra/voice-inworld

## 0.2.0-alpha.0

### Minor Changes

- Added Inworld AI voice integration with streaming TTS and batch STT. Supports inworld-tts-2 (default), inworld-tts-1.5-max, and inworld-tts-1.5-mini models for text-to-speech, with groq/whisper-large-v3 for speech-to-text. Includes 22+ built-in voices, configurable audio encoding, per-call `deliveryMode` and `language` overrides (deliveryMode honored only by inworld-tts-2), and progressive NDJSON audio streaming with backpressure handling. ([#14945](https://github.com/mastra-ai/mastra/pull/14945))

### Patch Changes

- Updated dependencies [[`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f)]:
  - @mastra/core@1.33.0-alpha.11
