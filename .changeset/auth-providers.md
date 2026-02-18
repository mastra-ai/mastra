---
'@mastra/auth-cloud': minor
'@mastra/auth-workos': minor
'@mastra/auth-better-auth': patch
---

Add auth provider packages with RBAC support

- `@mastra/auth-cloud`: New package providing Mastra Cloud authentication with PKCE OAuth flow, session management, and role-based access control
- `@mastra/auth-workos`: Add full auth provider with SSO, RBAC, SCIM directory sync, and admin portal support
- `@mastra/auth-better-auth`: Expand to support new EE auth interfaces (IUserProvider, ISessionProvider, ISSOProvider)
