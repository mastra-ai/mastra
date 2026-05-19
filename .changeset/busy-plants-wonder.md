---
'@mastra/core': minor
---

Added support for permission arrays in FGA checks and route configuration. When an array is provided, the user needs **any one** of the listed permissions (logical OR).

**Affected types**

- `FGACheckParams.permission`
- `FGARouteConfig.permission`
- `FGARouteInfo.requiresPermission`
- `FGADeniedError.permission`
- `CheckFGAOptions.permission`

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
