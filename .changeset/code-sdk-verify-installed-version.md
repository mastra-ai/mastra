---
"@mastra/code-sdk": patch
---

Added on-disk verification to the update utilities: `runUpdate` now returns the package manager's stderr, and the new `performUpdate` locates the running install, delegates the update to the tool that owns it (for example vite-plus), verifies the on-disk version when available, and reports when a readable installed version remains unchanged.
