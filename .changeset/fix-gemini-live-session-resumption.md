---
"@mastra/voice-google-gemini-live": patch
---

Fix resumeSession() always timing out. The provider now implements Gemini Live's real session-resumption protocol: the setup frame includes session_resumption to request server-issued tokens, inbound sessionResumptionUpdate frames store the real handle, and resumeSession() routes through the setup frame instead of emitting a non-standard event.
