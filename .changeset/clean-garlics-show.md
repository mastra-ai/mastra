---
'@mastra/auth-workos': minor
---

Added optional `getAvailableRoles` and `getPermissionsForRole` methods to the WorkOS RBAC provider, so consumers can list configured roles and inspect their permissions through `@mastra/auth-workos`.

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
