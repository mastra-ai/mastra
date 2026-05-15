---
'@mastra/core': minor
---

Added support for permission arrays in FGA checks and route configuration. When an array is provided, the user needs **any one** of the listed permissions (logical OR).

**Affected types**

- `FGACheckParams.permission`
- `FGARouteConfig.permission`
- `FGARouteInfo.requiresPermission`
- `FGADeniedError.permission`

Single-permission usage continues to work unchanged.

```ts
// Before — single permission only
await fga.check({
  resource: { type: 'agent', id: 'abc' },
  permission: 'agents:read',
});

// After — single permission or array (ANY-of)
await fga.check({
  resource: { type: 'agent', id: 'abc' },
  permission: ['agents:read', 'agents:execute'],
});
```

**Also in this release**

- New `MASTRA_USER_KEY`, `MASTRA_USER_PERMISSIONS_KEY`, `MASTRA_USER_ROLES_KEY` constants for request-context lookups by downstream packages.
- `getEffectivePermission()` now recognizes stored resource families (`stored-agents`, `stored-skills`, `stored-prompt-blocks`, `stored-mcp-clients`, `stored-scorers`, `stored-workspaces`) and `publish` / `activate` / `restore` action suffixes. Return type widened to `string | string[] | null` to support routes that map to multiple permissions.
