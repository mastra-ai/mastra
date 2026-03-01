---
'@mastra/auth-better-auth': patch
'@mastra/hono': patch
'@mastra/server': patch
---

Fix cookie-based and bearer token authentication for better-auth integration.

Requests using only cookies (e.g. `credentials: "include"` from a browser) were rejected with 401 before the auth provider could verify them. Bearer tokens passed via the `Authorization` header were also rejected because `better-auth` only reads session tokens from the `Cookie` header.

- Auth middleware now allows requests with cookies (no `Authorization` header) to reach the auth provider
- Bearer tokens are converted into a `better-auth.session_token` cookie so `better-auth` can verify them
