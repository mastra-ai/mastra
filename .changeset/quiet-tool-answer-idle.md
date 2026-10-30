---
'@mastra/core': patch
---

Fixed AgentController sessions getting stuck in a running state when answering a suspended tool call or tool approval fails before the resumed run starts (for example when `sendStreamResume` throws). The session now goes back to idle, the tool call stays parked, and a retry resumes it normally. Fixes #26870.
