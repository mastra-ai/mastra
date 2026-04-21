---
'@mastra/auth-workos': minor
---

Added `MastraFGAWorkos` provider for Fine-Grained Authorization using the WorkOS Authorization API. Implements `IFGAManager` interface with support for:

- Authorization checks (`check()`, `require()`, `filterAccessible()`)
- Resource management (`createResource()`, `getResource()`, `listResources()`, `updateResource()`, `deleteResource()`)
- Role assignments (`assignRole()`, `removeRole()`, `listRoleAssignments()`)
- `resourceMapping` and `permissionMapping` for translating Mastra resource types and permissions to WorkOS resource type slugs and permission slugs

```typescript
import { MastraFGAWorkos } from '@mastra/auth-workos';

const fga = new MastraFGAWorkos({
  organizationId: 'org_abc123',
  resourceMapping: {
    agent: { fgaResourceType: 'team', deriveId: ctx => ctx.user.teamId },
  },
  permissionMapping: {
    'agents:execute': 'manage-workflows',
  },
});

// Check whether a user can execute an agent
const allowed = await fga.check(user, {
  resource: { type: 'agent', id: 'my-agent' },
  permission: 'agents:execute',
});
```
