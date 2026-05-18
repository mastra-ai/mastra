---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/voice-aws-nova-sonic': patch
'@mastra/voice-azure': patch
'@mastra/voice-cloudflare': patch
'@mastra/voice-deepgram': patch
'@mastra/voice-elevenlabs': patch
'@mastra/voice-gladia': patch
'@mastra/voice-google': patch
'@mastra/voice-google-gemini-live': patch
'@mastra/voice-inworld': patch
'@mastra/voice-modelslab': patch
'@mastra/voice-murf': patch
'@mastra/voice-openai': patch
'@mastra/voice-openai-realtime': patch
'@mastra/voice-playai': patch
'@mastra/voice-sarvam': patch
'@mastra/voice-speechify': patch
---

Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions.

`@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.
