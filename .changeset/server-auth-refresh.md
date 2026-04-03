---
"@mastra/server": patch
---

Add POST /auth/refresh endpoint that calls ISessionProvider.refreshSession() and returns new session headers
