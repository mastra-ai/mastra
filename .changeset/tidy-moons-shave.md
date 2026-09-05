---
'@mastra/voice-google-gemini-live': patch
---

Send a functionResponse when Gemini Live calls an unregistered tool name. Previously the provider emitted a tool_not_found error and returned without answering the call, leaving the turn unanswered so the model went silent until the user hung up.
