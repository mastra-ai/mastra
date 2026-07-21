---
'@mastra/core': patch
---

Added optional auth provider capability interfaces and type guards to `@mastra/core/server`: `IOrganizationsProvider` (personal organization bootstrap and admin checks), `IAuthInit` (host-driven initialization with database, public URL, and allowed origins), and `IAuthHttpHandler` (mounting a provider's own HTTP auth endpoints). Server hosts can use the `isOrganizationsProvider`, `isAuthHttpHandler`, and `hasAuthInit` guards to detect what an auth provider supports and wire routes accordingly.
