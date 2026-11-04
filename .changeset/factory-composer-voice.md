---
'@mastra/factory': patch
---

Added voice input to the Factory composer. Click the mic button to dictate. The clip is transcribed server-side through `POST /web/voice/transcribe` and the text is appended to your draft. Supported speech-to-text providers are OpenAI, Mistral Voxtral, Groq, Deepgram, and the other OpenAI-compatible hosts in the Mastra Code speech-to-text registry. OAuth subscriptions and deployment env keys are never used for transcription. Until a speech-to-text key is set up, the mic button links to the voice input settings instead of recording.

Configure it in **Settings → Models → Voice input**:

- **Factory model**: the voice model for everyone in the Factory. Only organization admins can change it. The list only offers models with a usable key.
- **Your model**: an optional personal override. Leave it empty to use the Factory's model.
- **Speech-to-text keys**: the providers you have a key for, plus **Add provider** to paste a key for any supported provider, including Deepgram. Voice uses the same key store as chat models.

The Factory's model scope decides which model and key apply. `factory` uses the Factory model with organization keys. `user` uses each member's choice and personal keys. `hybrid` tries the personal choice and key first, then falls back to the Factory model and organization key.
