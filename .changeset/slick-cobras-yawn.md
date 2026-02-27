---
'@mastra/core': patch
---

Fixed stdout pipe inheritance on Windows by conditionally disabling detached process mode and using taskkill for process tree cleanup
