---
'@mastra/core': patch
---

Fixed a session reporting a running run after `respondToToolSuspension()`, `respondToPersistedToolApproval()`, `approveToolCall()` or `declineToolCall()` failed before the resumed run started, for example when the suspended run could not be found. The session is now idle again and the tool call stays parked, so it can be answered again ([#26870](https://github.com/mastra-ai/mastra/issues/26870)).
