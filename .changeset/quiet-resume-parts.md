---
'@mastra/core': patch
---

Fixed duplicated history after resuming a suspended tool or sub-agent call. Earlier assistant messages are now updated in place instead of having their text and tool calls copied into the new reply, so each tool call is saved once no matter how many times a conversation resumes. Fixes #26150.
