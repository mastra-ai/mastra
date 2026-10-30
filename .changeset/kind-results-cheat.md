---
'@mastra/ai-sdk': patch
---

Added `delegatedToolCallId` and `delegatedToolName` to `data-tool-call-suspended` and `data-tool-call-approval` parts. When a supervisor delegates to a subagent, they name the subagent's tool call that paused, so a UI can label the prompt it shows. Fixes #28583.
