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

**Namespaced request-context keys**

`coreAuthMiddleware` now writes user state under namespaced keys (`mastra__user`, `mastra__userPermissions`, `mastra__userRoles`) instead of the previous bare keys (`user`, `userPermissions`, `userRoles`). This prevents collisions with caller-supplied request-context entries. Read these keys via the new `MASTRA_USER_KEY` / `MASTRA_USER_PERMISSIONS_KEY` / `MASTRA_USER_ROLES_KEY` constants exported from `@mastra/core`.

If you have custom middleware that reads `requestContext.get('user')` / `'userPermissions'` / `'userRoles'`, switch to the namespaced keys or the exported constants.
