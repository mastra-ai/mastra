---
'@mastra/memory': patch
---

Fixed observational memory crashes when counting conversations with failed tool calls or completed approvals. Failed tool calls use their error text, or `Tool execution failed` when no error text is stored. Completed approvals no longer cause token counting errors.
