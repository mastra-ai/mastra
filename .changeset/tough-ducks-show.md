---
'@mastra/voice-inworld': minor
---

Added Inworld AI voice integration with streaming TTS and batch STT. Supports inworld-tts-2 (default), inworld-tts-1.5-max, and inworld-tts-1.5-mini models for text-to-speech, with groq/whisper-large-v3 for speech-to-text. Includes 22+ built-in voices, configurable audio encoding, per-call `deliveryMode` and `language` overrides (deliveryMode honored only by inworld-tts-2), and progressive NDJSON audio streaming with backpressure handling.
