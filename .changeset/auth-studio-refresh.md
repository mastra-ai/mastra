---
"@mastra/auth-studio": patch
---

Fix refreshSession() to call shared API's /auth/refresh endpoint to get a fresh access token instead of just validating
