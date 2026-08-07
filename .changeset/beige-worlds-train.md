---
'@mastra/voice-google': patch
---

Fixed `GoogleVoice.listen()` failing with `ERR_STREAM_PREMATURE_CLOSE` on Node 22 and newer. Speech-to-text with Application Default Credentials now transcribes again. Fixes [#19206](https://github.com/mastra-ai/mastra/issues/19206).
