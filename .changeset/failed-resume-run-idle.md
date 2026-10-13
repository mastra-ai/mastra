---
'@mastra/core': patch
---

Fixed a session staying in the running state when a tool-call answer failed before its run started. This affected `respondToToolSuspension()`, `resumeToolCall()`, `respondToPersistedToolApproval()`, `approveToolCall()` and `declineToolCall()`, for example when the suspended run could not be found.

The session is now idle after such a failure. The tool call stays parked and can be answered ([#26870](https://github.com/mastra-ai/mastra/issues/26870)).
