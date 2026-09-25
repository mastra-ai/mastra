---
'@mastra/core': patch
---

Fixed Anthropic rejecting a thread with "'thinking' or 'redacted_thinking' blocks in the latest assistant message cannot be modified" after a tool call was approved or resumed with observational memory on. When an assistant message had already been sealed by observational memory and a copy of it came back with its tool call resolved, the whole message (including its signed thinking) was added again as a new message. The tool result is now recorded on the existing message and only genuinely new content is added, so each thinking block reaches the model once. Fixes #22802.
