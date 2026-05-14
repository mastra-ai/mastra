---
'@mastra/auth-workos': patch
---

Implemented the optional `getAvailableRoles` and `getPermissionsForRole` methods on the WorkOS RBAC provider, so consumers using `@mastra/core/auth/ee` capabilities can list configured roles and inspect their permissions through WorkOS.

```typescript
import { MastraRBACWorkos } from '@mastra/auth-workos';

const rbac = new MastraRBACWorkos({ /* config */ });

// List all available roles
const roles = await rbac.getAvailableRoles();
// [{ id: 'admin', name: 'Admin' }, { id: 'member', name: 'Member' }]

// Get permissions for a specific role
const permissions = await rbac.getPermissionsForRole('member');
// ['agents:read', 'workflows:read']
```
