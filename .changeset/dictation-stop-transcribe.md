---
'@mastra/react': patch
---

Fixed dictation in agent chat: stopping a recording now transcribes the audio instead of silently discarding it. Previously the transcript was dropped on every normal stop because the session was invalidated before transcription could start ([#19980](https://github.com/mastra-ai/mastra/issues/19980))
