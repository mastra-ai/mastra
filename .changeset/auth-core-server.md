---
'@mastra/core': minor
'@mastra/server': minor
---

Add auth and RBAC support to core framework and server.

- New `@mastra/core/auth` export with interfaces for RBAC, sessions, SSO, credentials, ACL, and user management
- Default implementations: static RBAC provider, cookie and memory session providers, built-in role definitions
- Server auth handlers for login, signup, logout, session management, and SSO flows
- Route-level permission enforcement via `requiresPermission` in route configs
- Fixed `isProtectedPath` to correctly allow studio UI to load in production mode
