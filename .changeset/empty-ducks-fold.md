---
'@mastra/auth-better-auth': patch
'@mastra/auth-google': patch
'@mastra/auth-studio': patch
'@mastra/auth-cloud': patch
'@mastra/auth-neon': patch
'@mastra/auth-okta': patch
'@mastra/auth-auth0': patch
'@mastra/auth-clerk': patch
---

Fixed reading request headers from Express-style plain header objects so cookie-based auth providers no longer throw and fail with a misleading 401.

Related to https://github.com/mastra-ai/mastra/issues/21253
