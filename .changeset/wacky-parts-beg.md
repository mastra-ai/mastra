---
'@mastra/server': minor
---

Routes can now require **any one of multiple permissions** by passing an array to `requiresPermission`. When an array is provided, the request is allowed if the caller holds any of the listed permissions. Existing single-string usage continues to work.

```ts
// Before — single permission only
{
  path: '/v1/things',
  method: 'GET',
  requiresPermission: 'things:read',
  handler,
}

// After — single permission or ANY-of array
{
  path: '/v1/things/:id/stream',
  method: 'GET',
  requiresPermission: ['things:read', 'things:execute'],
  handler,
}
```

Denial messages now read `Missing required permission: a or b or c` when an array is used.

**New endpoint**

`GET /api/auth/roles/:roleId/permissions` returns the resolved permission list for a role. Useful for client-side gating and admin tooling.

```ts
const res = await fetch('/api/auth/roles/admin/permissions', { credentials: 'include' });
// { "roleId": "admin", "permissions": ["*"] }
```

**Namespaced request-context keys (non-breaking)**

`coreAuthMiddleware` now writes user state under namespaced keys (`mastra__user`, `mastra__userPermissions`, `mastra__userRoles`) in addition to the existing bare keys (`user`, `userPermissions`, `userRoles`). The bare keys are still written for backward compatibility, so existing middleware, integrations, and built-in handlers that read `requestContext.get('user')` continue to work unchanged.

New code should prefer the namespaced constants to avoid collisions with caller-supplied request-context entries:

```ts
import {
  MASTRA_USER_KEY,
  MASTRA_USER_PERMISSIONS_KEY,
  MASTRA_USER_ROLES_KEY,
} from '@mastra/server/auth';

const user = requestContext.get(MASTRA_USER_KEY);
const permissions = requestContext.get(MASTRA_USER_PERMISSIONS_KEY) as string[] | undefined;
const roles = requestContext.get(MASTRA_USER_ROLES_KEY) as string[] | undefined;
```

The bare keys (`user`, `userPermissions`, `userRoles`) remain populated and are considered the documented public surface for this release; a future major release may deprecate them.

**Route permission derivation**

`getEffectivePermission()` now recognizes stored resource families (`stored-agents`, `stored-skills`, `stored-prompt-blocks`, `stored-mcp-clients`, `stored-scorers`, `stored-workspaces`) and `publish` / `activate` / `restore` action suffixes on stored-resource routes. Return type widened to `string | string[] | null` to support routes that map to multiple permissions.
