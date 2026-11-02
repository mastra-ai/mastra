---
'@mastra/auth-studio': minor
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Added `fetchAsRequestUser(request, path, init)` to `MastraAuthStudio`, which calls the Mastra platform API as the request's signed-in user and keeps their session cookie fresh. Factory uses it to create Mastra Gateway keys for the user's organization.
