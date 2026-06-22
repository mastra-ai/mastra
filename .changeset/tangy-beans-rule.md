---
'@mastra/voice-google-gemini-live': patch
---

Fixed realtime audio streaming being immediately rejected by the Gemini Live API. Audio frames now use the current API format, replacing a deprecated payload shape that caused the connection to close on the first frame.

The `session` event for disconnections now includes `code` and `reason` fields, so consumers can see why the server closed the connection.
