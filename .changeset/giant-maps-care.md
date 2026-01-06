---
'@mastra/core': patch
---

Fix requireApproval property being ignored for tools passed via toolsets, clientTools, and memoryTools parameters. The requireApproval flag now correctly propagates through all tool conversion paths, ensuring tools requiring approval will properly request user approval before execution.
