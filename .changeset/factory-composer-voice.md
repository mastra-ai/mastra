---
'@mastra/factory': minor
---

Added voice input to the Factory composer. Click the mic to dictate: the clip is transcribed server-side and the text is appended to your draft. Until a speech-to-text key is set up, the mic opens the voice input settings instead of recording.

Voice input follows the same rule as chats in that Factory:

- **Factory model scope**: everyone uses the Factory's voice model with organization keys. Only organization admins can change the model.
- **Personal or hybrid model scope**: each member uses their own voice model with their own keys. Organization keys are never used.

Configure it in **Settings → Models → Voice input**. The model picker only offers models with a key on that side, and **Add provider** saves a key for any supported provider: OpenAI, Mistral Voxtral, Groq, Deepgram, and the other OpenAI-compatible hosts in the Mastra Code speech-to-text registry. Voice uses the same key store as chat models. OAuth subscriptions are never used for transcription. With sign-in enabled, deployment env keys aren't used either; in local mode the provider env var applies before a saved key.
