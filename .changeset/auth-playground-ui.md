---
'@mastra/playground-ui': minor
---

Add auth UI domain with login/signup pages, permission-gated components, and role-based access control for the studio. When no auth is configured, all permissions default to permissive (backward compatible). Includes AuthRequired wrapper, usePermissions hook, PermissionDenied component, and 403 error handling across all table views.
