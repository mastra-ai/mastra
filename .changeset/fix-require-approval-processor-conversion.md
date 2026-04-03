---
'@mastra/core': patch
---

Fixed `requireApproval` being silently dropped for tools re-converted after input processors run. Tools with `requireApproval: true` now correctly pause for approval even when input processors like `ToolSearchProcessor` modify the tool list during agent execution.
