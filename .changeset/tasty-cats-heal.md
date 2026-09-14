---
'@mastra/voice-google-gemini-live': patch
---

Fixed realtime audio input to include the configured sample rate in its MIME type, so Gemini Live can interpret incoming PCM audio at the correct rate.
