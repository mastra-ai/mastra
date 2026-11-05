---
'@mastra/core': patch
'@mastra/auth': patch
---

`StaticRBACProvider.getPermissions()` no longer reorders the roles array returned by your `getUserRoles` callback. Previously, returning a user's own `roles` array (for example `getUserRoles: user => user.roles`) sorted it in place, and returning a frozen or read-only array made permission checks throw `TypeError: Cannot assign to read only property`.
