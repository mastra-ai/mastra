# @mastra/voice-inworld

## 0.1.0

### Minor Changes

- Initial release of Inworld AI voice provider for Mastra
- Streaming TTS via `/tts/v1/voice:stream` (NDJSON progressive streaming)
- Batch STT via `/stt/v1/transcribe`
- Voice listing via `/voices/v1/voices`
- Support for `inworld-tts-1.5-max` and `inworld-tts-1.5-mini` models
- Support for STT models: `inworld/inworld-stt-1`, `groq/whisper-large-v3`
- 22 built-in voices (Alex, Ashley, Craig, Dennis, etc.)
- Configurable audio encoding, sample rate, speaking rate, and temperature
