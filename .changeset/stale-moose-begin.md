---
'@mastra/factory': minor
---

Composer dictation with Mistral streams: words appear in the draft while you speak. Other speech-to-text providers, and a working Mistral key that can't start a live session, record a clip and transcribe it when you stop; a rejected or out-of-credit Mistral key fails before the microphone opens. Send waits until dictation finishes, so a message never goes out half-transcribed.

Each member can start 20 transcriptions or live dictations a minute on each Factory server process; past that, voice input answers 429 with `Retry-After`. Voice errors in the web app show a short, fixed reason, never the provider's raw error text.
