---
'@mastra/core': patch
---

Added an opt-in foundation for building agent-builder admin policies and role-aware capabilities, available under two new entry points.

**`@mastra/core/agent-builder/ee`**

Exposes types, validators, and picker utilities for working with model allowlists and admin model policies on stored agents — for example normalizing model candidates, choosing a default from a configured allowlist, and producing typed errors when a request violates policy.

**`@mastra/core/auth/ee`**

Adds optional methods on `IRBACProvider` for listing available roles and resolving the permissions for a given role:

```ts
interface IRBACProvider {
  // existing methods...
  getAvailableRoles?(): Promise<RoleDescriptor[]>;
  getPermissionsForRole?(role: string): Promise<PermissionDescriptor[]>;
}
```

Static defaults, an expanded permissions catalog, and a capabilities helper that surfaces `availableRoles` to clients when the provider supports it are also included. Providers that do not implement the new methods continue to work unchanged.

Also adds a `StorageBrowserRef` shape to `@mastra/core/storage` for referencing a configured headless browser on stored agents.
