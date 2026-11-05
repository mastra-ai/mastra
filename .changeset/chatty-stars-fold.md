---
'@mastra/factory': patch
'@mastra/react': patch
'@mastra/code-sdk': patch
'@mastra/voice-deepgram': patch
---

Fixed `listen` sending unset options such as `diarize=undefined` to Deepgram, which made transcription requests fail.
