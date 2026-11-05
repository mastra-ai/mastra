---
'@mastra/code-sdk': minor
'@mastra/factory': patch
'@mastra/react': patch
'@mastra/voice-deepgram': patch
---

Speech-to-text calls now give up after one minute and retry at most once, instead of waiting up to ten minutes with two retries. A stored OpenAI key no longer sends the server's `OPENAI_ORG_ID` or `OPENAI_PROJECT_ID`; only the `OPENAI_API_KEY` env key keeps them. Registry entries can now name a `realtimeModel` for live transcription, set for Mistral Voxtral.
