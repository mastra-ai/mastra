---
'@mastra/voice-google': patch
---

Fixed speech-to-text failing with ERR_STREAM_PREMATURE_CLOSE on Node 22 and newer. `GoogleVoice.listen()` now uses `@google-cloud/speech` v7, which shares the same authentication stack as the text-to-speech client. Transcription with Application Default Credentials works again. Fixes [#19206](https://github.com/mastra-ai/mastra/issues/19206).
