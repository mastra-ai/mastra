---
'mastra': patch
---

Improved `mastra build` error reporting: deployer failures during the build show structured error details (domain, category, and details), even when the deployer bundles its own copy of `MastraError`.
