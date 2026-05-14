---
'@mastra/auth-workos': patch
---

Implemented the optional `getAvailableRoles` and `getPermissionsForRole` methods on the WorkOS RBAC provider, so consumers using `@mastra/core/auth/ee` capabilities can list configured roles and inspect their permissions through WorkOS.
