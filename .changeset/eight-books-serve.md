---
'@mastra/core': patch
---

Fix incorrect type assertions in Tool class. Created `MastraToolInvocationOptions` type to properly extend AI SDK's `ToolInvocationOptions` with Mastra-specific properties (`suspend`, `resumeData`, `writableStream`). Removed unsafe type assertions from tool execution code.
