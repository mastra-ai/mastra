---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-cloudflare': patch
'mastra': patch
'@mastra/client-js': patch
---

Add auth and RBAC support to core framework and server infrastructure.

- New `@mastra/core/auth` export with interfaces for RBAC, sessions, SSO, credentials, ACL, and user management
- Default implementations: static RBAC provider, cookie and memory session providers, built-in role definitions
- Server auth handlers for login, signup, logout, session management, and SSO flows
- Route-level permission enforcement via `requiresPermission` in route configs
- Server adapter updates (Hono, Express, Fastify, Koa) with RBAC middleware, cookie auth fallthrough, and permission checking
- Client SDK `getFullUrl` helper and `AuthCapabilities` type export
- Deployer `MASTRA_PACKAGES_FILE` env var injection and dynamic CORS origin when auth is configured
- Fixed `isProtectedPath` to correctly allow studio UI to load in production mode
