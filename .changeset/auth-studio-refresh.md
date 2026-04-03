---
"@mastra/auth-studio": patch
---

Fix session refresh for studio-deployed instances. Sessions now properly refresh when expired, preventing users from being logged out every 5 minutes.
