---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/auth-studio': patch
---

Fixed unexpected sign-outs caused by expired access tokens triggering a 401 cascade. The auth middleware now transparently refreshes sessions server-side when the auth provider implements `ISessionProvider`, so clients never receive a 401 for a recoverable token expiry. Only truly expired sessions (e.g. refresh token expired) return 401.

**What changed**

- `coreAuthMiddleware` detects when `authenticateToken()` returns null and the auth provider supports session refresh (`refreshSession`, `getSessionIdFromRequest`, `getSessionHeaders`). It refreshes the session, sets updated `Set-Cookie` headers on the response, and re-authenticates — all in a single request with no client-side retry needed.
- `AuthResult` now carries an optional `headers` field so the middleware can pass `Set-Cookie` back through the server adapter.
- All server adapters (Hono, Express, Fastify, Koa) propagate refresh headers on both standard and custom API routes.
- `MastraAuthStudio` auth methods (`verifySessionCookie`, `handleCallback`, `refreshSession`, `verifyBearerToken`) now log errors instead of silently returning `null`, making SSO callback and session-validation failures diagnosable.
