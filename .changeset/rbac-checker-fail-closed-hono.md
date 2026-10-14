---
'@mastra/hono': patch
---

When RBAC is configured and the permission checker from `@mastra/core/auth/ee` can't be loaded, routes that require a permission now return 403 instead of skipping the permission check. Behaviour without RBAC is unchanged.
