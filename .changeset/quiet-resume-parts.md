---
'@mastra/core': patch
---

Fixed duplicated history after resuming a suspended tool or sub-agent call. When an earlier assistant message is re-added to the message list, it is now updated in place instead of having its text and tool calls copied into the current reply, so each tool call is saved once no matter how many times a conversation resumes — on both the supervisor's and the sub-agent's threads. Fixes #26150.
