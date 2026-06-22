---
"@mastra/voice-google-gemini-live": patch
---

Fix resumeSession() always timing out. Session resumption now works end-to-end: new sessions request server-issued tokens, inbound handles are stored and emitted, and resuming reconnects with the correct handle in the setup frame.
