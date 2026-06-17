---
"@mastra/server": patch
---

Fix TypeError crash when getStudio is unavailable. The dual-auth request router now safely optional-chains getStudio?.() so deployments with an older @mastra/core (< 1.42.0) degrade gracefully to server-only auth instead of crashing on every request.
