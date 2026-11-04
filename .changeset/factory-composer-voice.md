---
'@mastra/factory': patch
---

Added voice input to the Factory composer. Click the mic button to dictate. The clip is transcribed server-side through `POST /web/voice/transcribe` and the text is appended to your draft. Transcription uses your own speech-to-text API key, or the organization's if you don't have one (OpenAI, Mistral Voxtral, Deepgram, Groq, and the other `/voice` providers). OAuth subscriptions and deployment env keys are never used for transcription.
