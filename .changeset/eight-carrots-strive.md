---
'@mastra/deployer': patch
---

Fix dev playground auth to allow non-protected paths to bypass authentication when `MASTRA_DEV=true`, while still requiring the `x-mastra-dev-playground` header for protected endpoints
