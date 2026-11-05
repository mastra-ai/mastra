---
'@mastra/factory': minor
---

Composer dictation with Mistral now streams: words appear in the draft while you speak, instead of after you stop. Other speech-to-text providers, and a Mistral key that can't start a live session, keep recording a clip and transcribing it when you stop.

Slack voice clips that can't be transcribed no longer reach the agent with a note. The clip is dropped from the message and the sender gets a card only they can see, with the reason and, for a missing, rejected or out-of-credit key, an **Open voice settings** button. A message that was only failed clips no longer starts a run.

Each member can now start 20 transcriptions or live dictations a minute; past that, voice input answers 429 with `Retry-After`. Transcription errors in the web app now show a short, fixed reason instead of the provider's raw error text.
