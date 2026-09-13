---
'@mastra/voice-google-gemini-live': patch
---

Fixed Gemini Live voice calls not reporting token usage. The `usage` event is now emitted for every server frame that reports usage, including the frames that also carry turn content. Consumers now receive usage for their Gemini Live calls instead of only the occasional frame.

Fixes #23719.
