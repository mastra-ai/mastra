---
'@mastra/core': patch
---

Fixed input processors (e.g. TokenLimiterProcessor) throwing a TripWire when resuming a suspended tool call via resumeStream or approveToolCall. The resume flow now skips input processors since the messageList has no user messages during resume — the real conversation state lives in the workflow snapshot.
