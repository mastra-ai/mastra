---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/auth-studio': patch
---

Authentication now refreshes expired server-side sessions transparently, so recoverable token expiry no longer causes unexpected user sign-outs. Only truly expired sessions (e.g. refresh token dead) return a 401.

Server adapters now forward refreshed session cookies consistently, and auth-studio logs session validation and refresh failures to improve diagnostics.
