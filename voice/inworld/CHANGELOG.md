# @mastra/voice-inworld

## 0.1.0

### Minor Changes

- Initial release of Inworld AI voice provider for Mastra
- Streaming TTS via `/tts/v1/voice:stream` (NDJSON progressive streaming)
- Batch STT via `/stt/v1/transcribe`
- Voice listing via `/voices/v1/voices`
- Support for `inworld-tts-2` (default flagship), `inworld-tts-1.5-max`, and `inworld-tts-1.5-mini` models
- Support for STT model: `groq/whisper-large-v3`
- 22 built-in voices (Alex, Ashley, Craig, Dennis, etc.)
- Configurable audio encoding, sample rate, speaking rate, and temperature
- `deliveryMode` option (`STABLE` | `BALANCED` | `CREATIVE`) for steering on `inworld-tts-2`
- Per-call `language` option (BCP-47) for TTS
