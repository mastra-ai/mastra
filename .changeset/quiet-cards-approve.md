---
'@mastra/core': patch
---

Fixed channel tool approval actions on tool calls whose ID contains a colon. `tool_approve:<toolCallId>` and `tool_deny:<toolCallId>` now take everything after the first colon as the tool call ID, so a click no longer resolves to the wrong pending approval.
